from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.core.deps import get_client_ip_hash, get_current_user, get_current_user_optional
from app.core.moderation import find_banned
from app.core.rate_limit import comment_limiter, post_limiter, view_limiter, vote_limiter
from app.api.v1._present import review_overall, review_target
from app.models import (
    Post, PostCategory, PostComment, PostCommentVote, PostScrap, PostVote, Region, RegionFollow, Review,
    ReviewComment, ReviewScrap, ReviewVote, Station, User, UserRole,
)
from app.models.community import POST_CATEGORY_LABELS
from app.models.review import case_type_label as review_case_type_label, role_label as review_role_label
from app.schemas.community import (
    BoardFeedItem, CommentCreate, CommentOut, PostCreate, PostOut, PostReceipt, RegionFollowOut, ScrapStatus, VoteIn,
    VoteSummary,
)
from app.schemas.public import Page
from app.services import takedown as takedown_svc
from app.services.audit import log_action
from app.services.engagement import ANON_LABEL, cast_vote, comment_counts, comment_tree, scrapped_set, vote_summaries
from app.services.ratings import visible_reviews

router = APIRouter(tags=["community"])


# ---------- 관심 지역 ----------
@router.get("/me/regions", response_model=list[RegionFollowOut])
def list_my_regions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.execute(
        select(Region).join(RegionFollow, RegionFollow.region_id == Region.id)
        .where(RegionFollow.user_id == user.id).order_by(RegionFollow.created_at.asc())
    ).scalars().all()
    return [RegionFollowOut(region_id=r.id, region_name=r.name, region_full_name=r.full_name) for r in rows]


@router.post("/me/regions/{region_id}", response_model=RegionFollowOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(vote_limiter)])
def follow_region(region_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    region = db.get(Region, region_id)
    if not region:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "지역을 찾을 수 없습니다.")
    if not db.scalar(select(RegionFollow.id).where(RegionFollow.user_id == user.id, RegionFollow.region_id == region_id)):
        db.add(RegionFollow(user_id=user.id, region_id=region_id))
        try:
            db.commit()
        except IntegrityError:  # 동시 요청으로 중복 등록된 경우 — 이미 등록된 것으로 취급
            db.rollback()
    return RegionFollowOut(region_id=region.id, region_name=region.name, region_full_name=region.full_name)


@router.delete("/me/regions/{region_id}", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(vote_limiter)])
def unfollow_region(region_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    follow = db.scalar(select(RegionFollow).where(RegionFollow.user_id == user.id, RegionFollow.region_id == region_id))
    if follow:
        db.delete(follow)
        db.commit()


# ---------- 게시판 ----------
def _nicknames(db: Session, posts: list[Post]) -> dict[int, str]:
    """글 작성자 닉네임을 한 번에 묶어 조회한다(author_id 가 None 인 익명 글은 애초에 조회
    대상에서 빠지므로, 쓰는 쪽에서 .get(author_id, ANON_LABEL) 로 집어야 한다)."""
    ids = {p.author_id for p in posts if p.author_id is not None}
    return dict(db.execute(select(User.id, User.nickname).where(User.id.in_(ids))).all()) if ids else {}


def _post_out(
    db: Session, p: Post, vote: VoteSummary, comment_count: int, author_nickname: str, user_id: int | None,
    is_scrapped: bool = False,
) -> PostOut:
    return PostOut(
        id=p.id, author_nickname=author_nickname, is_mine=(user_id is not None and p.author_id == user_id),
        region_id=p.region_id, region_name=p.region.name if p.region else None, station_id=p.station_id,
        station_name=p.station.name if p.station else None,
        category=p.category.value, category_label=POST_CATEGORY_LABELS[p.category],
        title=p.title, body=p.body, view_count=p.view_count, comment_count=comment_count,
        up=vote.up, down=vote.down, score=vote.score, my_vote=vote.my_vote, is_scrapped=is_scrapped,
        created_at=p.created_at.isoformat() if p.created_at else None,
        updated_at=p.updated_at.isoformat() if p.updated_at else None,
        is_blinded=p.is_blinded, blind_reason=p.blind_reason if p.is_blinded else None,
    )


_PERIOD_DAYS = {"today": 1, "week": 7, "month": 30}


@router.get("/posts", response_model=Page[PostOut])
def list_posts(
    request: Request,
    region_id: str | None = None, station_id: int | None = None, category: PostCategory | None = None,
    q: str | None = Query(None, max_length=50, description="제목·본문 검색어"),
    sort: str = Query("new", pattern="^(new|top)$"),
    period: str = Query("all", pattern="^(today|week|month|all)$", description="sort=top 일 때만 적용되는 베스트 기간"),
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional),
):
    base = select(Post).where(Post.is_removed.is_(False), Post.is_blinded.is_(False))
    if region_id:
        base = base.where(Post.region_id == region_id)
    if station_id:
        base = base.where(Post.station_id == station_id)
    if category:
        base = base.where(Post.category == category)
    if q := (q.strip() if q else None):
        base = base.where((Post.title.contains(q, autoescape=True)) | (Post.body.contains(q, autoescape=True)))
    if sort == "top" and period != "all":
        since = datetime.now(timezone.utc) - timedelta(days=_PERIOD_DAYS[period])
        base = base.where(Post.created_at >= since)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    order = (Post.score.desc(), Post.created_at.desc(), Post.id.desc()) if sort == "top" else (Post.created_at.desc(), Post.id.desc())
    # region/station 이름을 글마다 따로 조회하면 N+1 이 나므로 한 번에 묶어 가져온다.
    rows = base.options(joinedload(Post.region), joinedload(Post.station))
    posts = db.scalars(rows.order_by(*order).offset((page - 1) * size).limit(size)).all()

    ids = [p.id for p in posts]
    uid = user.id if user else None
    votes = vote_summaries(db, PostVote, PostVote.post_id, ids, uid, None if uid else get_client_ip_hash(request))
    counts = comment_counts(db, PostComment, PostComment.post_id, ids)
    scrapped = scrapped_set(db, PostScrap, PostScrap.post_id, ids, uid)
    nicknames = _nicknames(db, posts)
    items = [_post_out(db, p, votes[p.id], counts[p.id], nicknames.get(p.author_id, ANON_LABEL), uid, p.id in scrapped) for p in posts]
    return Page(items=items, total=total, page=page, size=size)


@router.get("/board/feed", response_model=Page[BoardFeedItem])
def board_feed(
    request: Request,
    region_id: str | None = None,
    category: str | None = Query(None, pattern="^(info|question|chat|suggestion|other|review)$"),
    q: str | None = Query(None, max_length=50, description="제목·본문 검색어"),
    sort: str = Query("new", pattern="^(new|top)$"),
    period: str = Query("all", pattern="^(today|week|month|all)$", description="sort=top 일 때만 적용되는 베스트 기간"),
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional),
):
    """게시판 '전체' 피드 — 자유게시글과 평가를 한 화면에 섞어 보여준다(2026-10 결정, 의뢰인 요청:
    "커뮤니티에 평가도 같이 올라오고 거기에 댓글도 달 수 있게, 전체에서도 볼 수 있게"). 평가 자체의
    댓글·투표·스크랩은 기존 /reviews 엔드포인트를 그대로 쓴다 — 이 피드는 "어디서 보이는지"만
    새로 만든 것이고, 실제 댓글 데이터는 경찰서 상세 페이지의 평가와 완전히 같은 글(review_id
    기준)이라 어느 쪽에서 댓글을 달아도 서로 바로 보인다.
    category='review' 면 평가만, info/question/chat/other 면 해당 카테고리 게시글만, 둘 다
    비우면(전체) 게시글 전 카테고리 + 평가를 섞어서 보여준다.
    두 테이블은 컬럼 구조가 달라 SQL UNION 대신, 각각 필요한 만큼 가져와 애플리케이션에서
    병합 정렬한다 — 이 서비스 규모(페이지당 최대 50건)에서는 비용이 무시할 만하다."""
    want_posts = category != "review"
    want_reviews = category is None or category == "review"
    uid = user.id if user else None
    ip_hash = None if uid else get_client_ip_hash(request)
    qq = q.strip() if q else None
    since = datetime.now(timezone.utc) - timedelta(days=_PERIOD_DAYS[period]) if (sort == "top" and period != "all") else None
    # 병합 정렬 후 뒤에서 잘라내야 하므로, 각 소스에서 "현재 페이지 끝까지"에 해당하는 만큼
    # 넉넉히 앞부분을 끌어온다.
    fetch_n = page * size

    total_posts = 0
    post_items: list[BoardFeedItem] = []
    if want_posts:
        base = select(Post).where(Post.is_removed.is_(False), Post.is_blinded.is_(False))
        if region_id:
            base = base.where(Post.region_id == region_id)
        if category:
            base = base.where(Post.category == category)
        if qq:
            base = base.where((Post.title.contains(qq, autoescape=True)) | (Post.body.contains(qq, autoescape=True)))
        if since:
            base = base.where(Post.created_at >= since)
        total_posts = db.scalar(select(func.count()).select_from(base.subquery())) or 0
        order = (Post.score.desc(), Post.created_at.desc(), Post.id.desc()) if sort == "top" else (Post.created_at.desc(), Post.id.desc())
        rows = base.options(joinedload(Post.region), joinedload(Post.station))
        posts = db.scalars(rows.order_by(*order).limit(fetch_n)).all()
        ids = [p.id for p in posts]
        votes = vote_summaries(db, PostVote, PostVote.post_id, ids, uid, ip_hash)
        counts = comment_counts(db, PostComment, PostComment.post_id, ids)
        scrapped = scrapped_set(db, PostScrap, PostScrap.post_id, ids, uid) if uid else set()
        nicknames = _nicknames(db, posts)
        for p in posts:
            v = votes[p.id]
            post_items.append(BoardFeedItem(
                kind="post", id=p.id, region_name=p.region.name if p.region else None,
                station_id=p.station_id, station_name=p.station.name if p.station else None,
                category=p.category.value, category_label=POST_CATEGORY_LABELS[p.category],
                title=p.title, body=p.body, author_nickname=nicknames.get(p.author_id, ANON_LABEL),
                is_mine=(uid is not None and p.author_id == uid),
                view_count=p.view_count, comment_count=counts[p.id],
                up=v.up, down=v.down, score=v.score, my_vote=v.my_vote, is_scrapped=p.id in scrapped,
                created_at=p.created_at.isoformat() if p.created_at else None,
            ))

    total_reviews = 0
    review_items: list[BoardFeedItem] = []
    if want_reviews:
        rbase = visible_reviews(Review).join(Station, Station.id == Review.station_id)
        if region_id:
            rbase = rbase.where(Station.region_id == region_id)
        if qq:
            rbase = rbase.where(Review.body.contains(qq, autoescape=True))
        if since:
            rbase = rbase.where(Review.published_at >= since)
        total_reviews = db.scalar(select(func.count()).select_from(rbase.subquery())) or 0
        rrows = rbase.options(joinedload(Review.station).joinedload(Station.region))
        order = (Review.published_at.desc(), Review.id.desc())  # 평가는 추천순 정렬까지는 아직 지원 안 함(아래 참고)
        reviews = db.scalars(rrows.order_by(*order).limit(fetch_n)).all()
        ids = [r.id for r in reviews]
        votes = vote_summaries(db, ReviewVote, ReviewVote.review_id, ids, uid, ip_hash)
        counts = comment_counts(db, ReviewComment, ReviewComment.review_id, ids)
        scrapped = scrapped_set(db, ReviewScrap, ReviewScrap.review_id, ids, uid) if uid else set()
        for r in reviews:
            v = votes[r.id]
            review_items.append(BoardFeedItem(
                kind="review", id=r.id,
                region_name=r.station.region.name if r.station and r.station.region else None,
                station_id=r.station_id, station_name=r.station.name if r.station else None,
                category="review", category_label="평가", title=None, body=r.body or "",
                role_label=review_role_label(r), overall=review_overall(r), evidence_verified=r.evidence_verified,
                target_label=review_target(r)["target_label"],
                comment_count=counts[r.id], up=v.up, down=v.down, score=v.score, my_vote=v.my_vote,
                is_scrapped=r.id in scrapped,
                created_at=r.published_at.isoformat() if r.published_at else None,
            ))
        # sort=top 일 때 평가도 추천순으로 섞이게 끌어온 뒤 다시 정렬(위에서는 최신순으로만 가져왔으므로).
        if sort == "top":
            review_items.sort(key=lambda x: (x.score, x.created_at or ""), reverse=True)

    merged = post_items + review_items
    if sort == "top":
        merged.sort(key=lambda x: (x.score, x.created_at or ""), reverse=True)
    else:
        merged.sort(key=lambda x: x.created_at or "", reverse=True)

    start = (page - 1) * size
    items = merged[start:start + size]
    return Page(items=items, total=total_posts + total_reviews, page=page, size=size)


@router.get("/posts/mine", response_model=Page[PostOut])
def list_my_posts(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    """로그인한 본인이 쓴 글 — 블라인드된 글도 포함해서 상태와 사유를 보여준다(삭제된 글은 제외)."""
    base = select(Post).where(Post.author_id == user.id, Post.is_removed.is_(False))
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    posts = db.scalars(
        base.options(joinedload(Post.region), joinedload(Post.station))
        .order_by(Post.created_at.desc(), Post.id.desc()).offset((page - 1) * size).limit(size)
    ).all()
    ids = [p.id for p in posts]
    votes = vote_summaries(db, PostVote, PostVote.post_id, ids, user.id)
    counts = comment_counts(db, PostComment, PostComment.post_id, ids)
    scrapped = scrapped_set(db, PostScrap, PostScrap.post_id, ids, user.id)
    items = [_post_out(db, p, votes[p.id], counts[p.id], user.nickname, user.id, p.id in scrapped) for p in posts]
    return Page(items=items, total=total, page=page, size=size)


@router.get("/posts/popular", response_model=list[PostOut])
def popular_posts(
    request: Request,
    region_id: str | None = None, period: str = Query("week", pattern="^(today|week|month|all)$"),
    limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional),
):
    """기간별(오늘/주간/월간/전체) 추천 점수 상위 — 홈 "인기글" 위젯 + 게시판 베스트용."""
    base = select(Post).where(Post.is_removed.is_(False), Post.is_blinded.is_(False))
    if period != "all":
        since = datetime.now(timezone.utc) - timedelta(days=_PERIOD_DAYS[period])
        base = base.where(Post.created_at >= since)
    if region_id:
        base = base.where(Post.region_id == region_id)
    rows = base.options(joinedload(Post.region), joinedload(Post.station))
    posts = db.scalars(rows.order_by(Post.score.desc(), Post.created_at.desc(), Post.id.desc()).limit(limit)).all()
    ids = [p.id for p in posts]
    uid = user.id if user else None
    votes = vote_summaries(db, PostVote, PostVote.post_id, ids, uid, None if uid else get_client_ip_hash(request))
    counts = comment_counts(db, PostComment, PostComment.post_id, ids)
    scrapped = scrapped_set(db, PostScrap, PostScrap.post_id, ids, uid)
    nicknames = _nicknames(db, posts)
    return [_post_out(db, p, votes[p.id], counts[p.id], nicknames.get(p.author_id, ANON_LABEL), uid, p.id in scrapped) for p in posts]


@router.post("/posts", response_model=PostReceipt, status_code=status.HTTP_201_CREATED, dependencies=[Depends(post_limiter)])
def create_post(body: PostCreate, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    """게시글 작성. 평가(Review)와 마찬가지로 로그인 없이도 익명으로 작성할 수 있다
    (2026-10 결정). 로그인한 상태로 쓰면 author_id 가 채워져 본인이 나중에 삭제할 수 있지만,
    익명 글은 작성자 본인이 지울 방법이 없고 관리자만 지울 수 있다.

    지역도 선택 입력이다(2026-10 결정 — 자유게시판 글까지 지역을 강제로 고르게 할 필요는
    없다는 피드백). 지역 없이 경찰서만 지정할 수는 없다 — 경찰서는 특정 지역 소속이라
    그러면 글의 지역이 모호해지므로, 그 경우엔 경찰서가 속한 지역으로 채워 넣는다."""
    region_id = body.region_id
    if region_id is not None and not db.get(Region, region_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "지역을 찾을 수 없습니다.")
    if body.station_id is not None:
        station = db.get(Station, body.station_id)
        if not station:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "경찰서를 찾을 수 없습니다.")
        if region_id is None:
            region_id = station.region_id
        elif station.region_id != region_id:
            raise HTTPException(422, "선택한 경찰서가 해당 지역 소속이 아닙니다.")
    banned = find_banned(f"{body.title}\n{body.body}")
    if banned:
        raise HTTPException(422, {"message": "게시할 수 없는 표현이 포함되어 있습니다.", "banned": banned})
    post = Post(
        author_id=user.id if user else None, region_id=region_id, station_id=body.station_id,
        category=body.category, title=body.title, body=body.body,
    )
    db.add(post)
    db.commit()
    return PostReceipt(id=post.id, message="게시되었습니다.")


@router.get("/posts/{post_id}", response_model=PostOut)
def get_post(
    request: Request, post_id: int, db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    p = db.get(Post, post_id)
    # 블라인드된 글은 작성자 본인과 관리자에게만 보인다(본인은 사유를 확인할 수 있게).
    can_see_blinded = user is not None and (p is not None and p.author_id == user.id or user.role == UserRole.admin)
    if not p or p.is_removed or (p.is_blinded and not can_see_blinded):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "글을 찾을 수 없습니다.")
    uid = user.id if user else None
    votes = vote_summaries(db, PostVote, PostVote.post_id, [post_id], uid, None if uid else get_client_ip_hash(request))
    counts = comment_counts(db, PostComment, PostComment.post_id, [post_id])
    scrapped = scrapped_set(db, PostScrap, PostScrap.post_id, [post_id], uid)
    nickname = db.scalar(select(User.nickname).where(User.id == p.author_id)) if p.author_id else None
    return _post_out(db, p, votes[post_id], counts[post_id], nickname or ANON_LABEL, uid, post_id in scrapped)


@router.post("/posts/{post_id}/view", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(view_limiter)])
def increment_post_view(post_id: int, db: Session = Depends(get_db)):
    """조회수 증가 전용 — GET /posts/{id} 와 분리한 이유는, 그 글 상세 페이지 하나를 보는 동안에도
    (메타데이터 생성 + 서버 렌더 + 클라이언트 쪽 로그인 상태 보정) 여러 번 호출되기 때문이다.
    이 엔드포인트는 프론트에서 실제 화면이 한 번 그려질 때 딱 한 번만 호출한다."""
    if db.scalar(select(Post.id).where(Post.id == post_id, Post.is_removed.is_(False), Post.is_blinded.is_(False))):
        db.execute(update(Post).where(Post.id == post_id).values(view_count=Post.view_count + 1))
        db.commit()


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.get(Post, post_id)
    if not p or p.is_removed:  # 블라인드된 본인 글도 삭제는 가능
        raise HTTPException(status.HTTP_404_NOT_FOUND, "글을 찾을 수 없습니다.")
    if p.author_id != user.id and user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "본인 글만 삭제할 수 있습니다.")
    p.is_removed = True
    log_action(db, user.id, "post.remove", "post", p.id, {"self": p.author_id == user.id})
    db.commit()


# ---------- 게시판 댓글 ----------
@router.get("/posts/{post_id}/comments", response_model=list[CommentOut])
def list_post_comments(
    request: Request, post_id: int, sort: str = Query("new", pattern="^(new|top)$"),
    db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional),
):
    p = db.get(Post, post_id)
    if not p or p.is_removed or p.is_blinded:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "글을 찾을 수 없습니다.")
    rows = [
        (c, nickname or ANON_LABEL)
        for c, nickname in db.execute(
            select(PostComment, User.nickname).outerjoin(User, User.id == PostComment.author_id)
            .where(PostComment.post_id == post_id).order_by(PostComment.created_at.asc())
        ).all()
    ]
    ids = [c.id for c, _ in rows]
    uid = user.id if user else None
    votes = vote_summaries(db, PostCommentVote, PostCommentVote.comment_id, ids, uid, None if uid else get_client_ip_hash(request))
    return comment_tree(rows, uid, votes, sort)


@router.post(
    "/posts/{post_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(comment_limiter)],
)
def create_post_comment(
    post_id: int, body: CommentCreate, db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    """게시글과 마찬가지로 로그인 없이도 익명으로 댓글을 달 수 있다(2026-10 결정) —
    추천/투표와 달리 댓글은 신뢰도 핵심 지표가 아니라서 글 작성과 같은 기준으로 맞췄다."""
    p = db.get(Post, post_id)
    if not p or p.is_removed or p.is_blinded:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "글을 찾을 수 없습니다.")
    banned = find_banned(body.body)
    if banned:
        raise HTTPException(422, {"message": "게시할 수 없는 표현이 포함되어 있습니다.", "banned": banned})
    if body.parent_id is not None:
        parent = db.get(PostComment, body.parent_id)
        if not parent or parent.post_id != post_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "댓글을 찾을 수 없습니다.")
        if parent.parent_id is not None:
            raise HTTPException(422, "대댓글에는 답글을 달 수 없습니다.")
    comment = PostComment(post_id=post_id, author_id=user.id if user else None, parent_id=body.parent_id, body=body.body)
    db.add(comment)
    db.commit()
    uid = user.id if user else None
    return comment_tree([(comment, user.nickname if user else ANON_LABEL)], uid)[0]


@router.delete("/post-comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post_comment(comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    comment = db.get(PostComment, comment_id)
    if not comment or comment.is_removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "댓글을 찾을 수 없습니다.")
    if comment.author_id != user.id and user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "본인 댓글만 삭제할 수 있습니다.")
    comment.is_removed = True
    comment.removed_at = takedown_svc.utcnow()
    log_action(db, user.id, "comment.remove", "post_comment", comment.id, {"self": comment.author_id == user.id})
    db.commit()


@router.post("/post-comments/{comment_id}/vote", response_model=VoteSummary, dependencies=[Depends(vote_limiter)])
def vote_post_comment(
    request: Request, comment_id: int, body: VoteIn, db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    comment = db.get(PostComment, comment_id)
    if not comment or comment.is_removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "댓글을 찾을 수 없습니다.")
    uid = user.id if user else None
    ip_hash = None if uid else get_client_ip_hash(request)
    cast_vote(db, PostCommentVote, PostCommentVote.comment_id, "comment_id", comment_id, body.value, uid, ip_hash)
    return vote_summaries(db, PostCommentVote, PostCommentVote.comment_id, [comment_id], uid, ip_hash)[comment_id]


@router.post("/posts/{post_id}/vote", response_model=VoteSummary, dependencies=[Depends(vote_limiter)])
def vote_post(
    request: Request, post_id: int, body: VoteIn, db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    # 글 행을 잠그고 시작한다 — 같은 글에 동시에 들어오는 투표 요청들이 서로 Post.score 증분을
    # 덮어써서(lost update) 캐시 컬럼이 실제 투표 합계와 어긋나는 걸 막는다(정렬 조작 방지).
    p = db.scalar(select(Post).where(Post.id == post_id).with_for_update())
    if not p or p.is_removed or p.is_blinded:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "글을 찾을 수 없습니다.")
    uid = user.id if user else None
    ip_hash = None if uid else get_client_ip_hash(request)
    voter_filter = PostVote.user_id == uid if uid is not None else PostVote.ip_hash == ip_hash
    existing = db.scalar(select(PostVote).where(PostVote.post_id == post_id, voter_filter))
    before = existing.value if existing else 0
    if body.value == 0:
        if existing:
            db.delete(existing)
    elif existing:
        existing.value = body.value
    else:
        db.add(PostVote(post_id=post_id, user_id=uid, ip_hash=ip_hash, value=body.value))
    # SQL 쪽 상대 증분(score = score + delta)으로 적용한다 — 파이썬에서 읽은 값에 더해 그대로
    # 덮어쓰면 위 잠금이 있어도 계산 경로 자체가 read-modify-write 라 방어가 약해진다.
    db.execute(update(Post).where(Post.id == post_id).values(score=Post.score + (body.value - before)))
    db.commit()
    return vote_summaries(db, PostVote, PostVote.post_id, [post_id], uid, ip_hash)[post_id]


@router.get("/me/scraps/posts", response_model=Page[PostOut])
def list_my_post_scraps(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    scrap_rows = db.execute(
        select(PostScrap.post_id).where(PostScrap.user_id == user.id).order_by(PostScrap.created_at.desc(), PostScrap.id.desc())
    ).all()
    ordered_ids = [pid for pid, in scrap_rows]
    total = len(ordered_ids)
    page_ids = ordered_ids[(page - 1) * size: (page - 1) * size + size]
    if not page_ids:
        return Page(items=[], total=total, page=page, size=size)

    posts = {
        p.id: p for p in db.scalars(
            select(Post).options(joinedload(Post.region), joinedload(Post.station))
            .where(Post.id.in_(page_ids), Post.is_removed.is_(False), Post.is_blinded.is_(False))
        ).all()
    }
    votes = vote_summaries(db, PostVote, PostVote.post_id, page_ids, user.id)
    counts = comment_counts(db, PostComment, PostComment.post_id, page_ids)
    nicknames = _nicknames(db, list(posts.values()))
    items = [
        _post_out(db, posts[pid], votes[pid], counts[pid], nicknames.get(posts[pid].author_id, ANON_LABEL), user.id, True)
        for pid in page_ids if pid in posts  # 삭제된 글은 조용히 건너뜀(스크랩한 순서 유지)
    ]
    return Page(items=items, total=total, page=page, size=size)


@router.post("/posts/{post_id}/scrap", response_model=ScrapStatus, dependencies=[Depends(vote_limiter)])
def scrap_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.get(Post, post_id)
    if not p or p.is_removed or p.is_blinded:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "글을 찾을 수 없습니다.")
    if not db.scalar(select(PostScrap.id).where(PostScrap.post_id == post_id, PostScrap.user_id == user.id)):
        db.add(PostScrap(post_id=post_id, user_id=user.id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    return ScrapStatus(scrapped=True)


@router.delete("/posts/{post_id}/scrap", response_model=ScrapStatus, dependencies=[Depends(vote_limiter)])
def unscrap_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    existing = db.scalar(select(PostScrap).where(PostScrap.post_id == post_id, PostScrap.user_id == user.id))
    if existing:
        db.delete(existing)
        db.commit()
    return ScrapStatus(scrapped=False)
