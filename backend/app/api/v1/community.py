from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import case, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_user_optional
from app.core.moderation import find_banned
from app.core.rate_limit import comment_limiter, post_limiter, vote_limiter
from app.models import Post, PostComment, PostScrap, PostVote, Region, RegionFollow, Station, User, UserRole
from app.schemas.community import (
    CommentCreate, CommentOut, PostCreate, PostOut, PostReceipt, RegionFollowOut, ScrapStatus, VoteIn, VoteSummary,
)
from app.schemas.public import Page
from app.services.audit import log_action
from app.services.engagement import comment_counts, comment_tree, scrapped_set, vote_summaries

router = APIRouter(tags=["community"])


# ---------- 관심 지역 ----------
@router.get("/me/regions", response_model=list[RegionFollowOut])
def list_my_regions(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    rows = db.execute(
        select(Region).join(RegionFollow, RegionFollow.region_id == Region.id)
        .where(RegionFollow.user_id == user.id).order_by(RegionFollow.created_at.asc())
    ).scalars().all()
    return [RegionFollowOut(region_id=r.id, region_name=r.name, region_full_name=r.full_name) for r in rows]


@router.post("/me/regions/{region_id}", response_model=RegionFollowOut, status_code=status.HTTP_201_CREATED)
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


@router.delete("/me/regions/{region_id}", status_code=status.HTTP_204_NO_CONTENT)
def unfollow_region(region_id: str, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    follow = db.scalar(select(RegionFollow).where(RegionFollow.user_id == user.id, RegionFollow.region_id == region_id))
    if follow:
        db.delete(follow)
        db.commit()


# ---------- 게시판 ----------
def _post_out(
    db: Session, p: Post, vote: VoteSummary, comment_count: int, author_nickname: str, user_id: int | None,
    is_scrapped: bool = False,
) -> PostOut:
    return PostOut(
        id=p.id, author_nickname=author_nickname, is_mine=(user_id is not None and p.author_id == user_id),
        region_id=p.region_id, region_name=p.region.name, station_id=p.station_id,
        station_name=p.station.name if p.station else None,
        title=p.title, body=p.body, comment_count=comment_count, score=vote.score, my_vote=vote.my_vote,
        is_scrapped=is_scrapped,
        created_at=p.created_at.isoformat() if p.created_at else None,
        updated_at=p.updated_at.isoformat() if p.updated_at else None,
    )


def _score_subq():
    return (
        select(func.coalesce(func.sum(case((PostVote.value == 1, 1), (PostVote.value == -1, -1), else_=0)), 0))
        .where(PostVote.post_id == Post.id).correlate(Post).scalar_subquery()
    )


@router.get("/posts", response_model=Page[PostOut])
def list_posts(
    region_id: str | None = None, station_id: int | None = None, sort: str = Query("new", pattern="^(new|top)$"),
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional),
):
    base = select(Post).where(Post.is_removed.is_(False))
    if region_id:
        base = base.where(Post.region_id == region_id)
    if station_id:
        base = base.where(Post.station_id == station_id)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    order = (_score_subq().desc(), Post.created_at.desc(), Post.id.desc()) if sort == "top" else (Post.created_at.desc(), Post.id.desc())
    posts = db.scalars(base.order_by(*order).offset((page - 1) * size).limit(size)).all()

    ids = [p.id for p in posts]
    uid = user.id if user else None
    votes = vote_summaries(db, PostVote, PostVote.post_id, ids, uid)
    counts = comment_counts(db, PostComment, PostComment.post_id, ids)
    scrapped = scrapped_set(db, PostScrap, PostScrap.post_id, ids, uid)
    nicknames = dict(db.execute(select(User.id, User.nickname).where(User.id.in_({p.author_id for p in posts}))).all())
    items = [_post_out(db, p, votes[p.id], counts[p.id], nicknames[p.author_id], uid, p.id in scrapped) for p in posts]
    return Page(items=items, total=total, page=page, size=size)


@router.get("/posts/popular", response_model=list[PostOut])
def popular_posts(
    region_id: str | None = None, days: int = Query(14, ge=1, le=90), limit: int = Query(5, ge=1, le=20),
    db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional),
):
    """최근 N일 내 글 중 추천 점수 상위 — 홈 "인기글" 위젯용."""
    since = datetime.now(timezone.utc) - timedelta(days=days)
    base = select(Post).where(Post.is_removed.is_(False), Post.created_at >= since)
    if region_id:
        base = base.where(Post.region_id == region_id)
    posts = db.scalars(base.order_by(_score_subq().desc(), Post.created_at.desc(), Post.id.desc()).limit(limit)).all()
    ids = [p.id for p in posts]
    uid = user.id if user else None
    votes = vote_summaries(db, PostVote, PostVote.post_id, ids, uid)
    counts = comment_counts(db, PostComment, PostComment.post_id, ids)
    scrapped = scrapped_set(db, PostScrap, PostScrap.post_id, ids, uid)
    nicknames = dict(db.execute(select(User.id, User.nickname).where(User.id.in_({p.author_id for p in posts}))).all())
    return [_post_out(db, p, votes[p.id], counts[p.id], nicknames[p.author_id], uid, p.id in scrapped) for p in posts]


@router.post("/posts", response_model=PostReceipt, status_code=status.HTTP_201_CREATED, dependencies=[Depends(post_limiter)])
def create_post(body: PostCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    region = db.get(Region, body.region_id)
    if not region:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "지역을 찾을 수 없습니다.")
    if body.station_id is not None:
        station = db.get(Station, body.station_id)
        if not station or station.region_id != body.region_id:
            raise HTTPException(422, "선택한 경찰서가 해당 지역 소속이 아닙니다.")
    banned = find_banned(f"{body.title}\n{body.body}")
    if banned:
        raise HTTPException(422, {"message": "게시할 수 없는 표현이 포함되어 있습니다.", "banned": banned})
    post = Post(author_id=user.id, region_id=body.region_id, station_id=body.station_id, title=body.title, body=body.body)
    db.add(post)
    db.commit()
    return PostReceipt(id=post.id, message="게시되었습니다.")


@router.get("/posts/{post_id}", response_model=PostOut)
def get_post(post_id: int, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    p = db.get(Post, post_id)
    if not p or p.is_removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "글을 찾을 수 없습니다.")
    uid = user.id if user else None
    votes = vote_summaries(db, PostVote, PostVote.post_id, [post_id], uid)
    counts = comment_counts(db, PostComment, PostComment.post_id, [post_id])
    scrapped = scrapped_set(db, PostScrap, PostScrap.post_id, [post_id], uid)
    nickname = db.scalar(select(User.nickname).where(User.id == p.author_id))
    return _post_out(db, p, votes[post_id], counts[post_id], nickname, uid, post_id in scrapped)


@router.delete("/posts/{post_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.get(Post, post_id)
    if not p or p.is_removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "글을 찾을 수 없습니다.")
    if p.author_id != user.id and user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "본인 글만 삭제할 수 있습니다.")
    p.is_removed = True
    log_action(db, user.id, "post.remove", "post", p.id, {"self": p.author_id == user.id})
    db.commit()


# ---------- 게시판 댓글 ----------
@router.get("/posts/{post_id}/comments", response_model=list[CommentOut])
def list_post_comments(post_id: int, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    p = db.get(Post, post_id)
    if not p or p.is_removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "글을 찾을 수 없습니다.")
    rows = db.execute(
        select(PostComment, User.nickname).join(User, User.id == PostComment.author_id)
        .where(PostComment.post_id == post_id).order_by(PostComment.created_at.asc())
    ).all()
    return comment_tree(rows, user.id if user else None)


@router.post(
    "/posts/{post_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(comment_limiter)],
)
def create_post_comment(post_id: int, body: CommentCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.get(Post, post_id)
    if not p or p.is_removed:
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
    comment = PostComment(post_id=post_id, author_id=user.id, parent_id=body.parent_id, body=body.body)
    db.add(comment)
    db.commit()
    return comment_tree([(comment, user.nickname)], user.id)[0]


@router.delete("/post-comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_post_comment(comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    comment = db.get(PostComment, comment_id)
    if not comment or comment.is_removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "댓글을 찾을 수 없습니다.")
    if comment.author_id != user.id and user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "본인 댓글만 삭제할 수 있습니다.")
    comment.is_removed = True
    log_action(db, user.id, "comment.remove", "post_comment", comment.id, {"self": comment.author_id == user.id})
    db.commit()


@router.post("/posts/{post_id}/vote", response_model=VoteSummary, dependencies=[Depends(vote_limiter)])
def vote_post(post_id: int, body: VoteIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.get(Post, post_id)
    if not p or p.is_removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "글을 찾을 수 없습니다.")
    existing = db.scalar(select(PostVote).where(PostVote.post_id == post_id, PostVote.user_id == user.id))
    if body.value == 0:
        if existing:
            db.delete(existing)
    elif existing:
        existing.value = body.value
    else:
        db.add(PostVote(post_id=post_id, user_id=user.id, value=body.value))
    db.commit()
    return vote_summaries(db, PostVote, PostVote.post_id, [post_id], user.id)[post_id]


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

    posts = {p.id: p for p in db.scalars(select(Post).where(Post.id.in_(page_ids), Post.is_removed.is_(False))).all()}
    votes = vote_summaries(db, PostVote, PostVote.post_id, page_ids, user.id)
    counts = comment_counts(db, PostComment, PostComment.post_id, page_ids)
    nicknames = dict(db.execute(select(User.id, User.nickname).where(User.id.in_({p.author_id for p in posts.values()}))).all())
    items = [
        _post_out(db, posts[pid], votes[pid], counts[pid], nicknames[posts[pid].author_id], user.id, True)
        for pid in page_ids if pid in posts  # 삭제된 글은 조용히 건너뜀(스크랩한 순서 유지)
    ]
    return Page(items=items, total=total, page=page, size=size)


@router.post("/posts/{post_id}/scrap", response_model=ScrapStatus, dependencies=[Depends(vote_limiter)])
def scrap_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    p = db.get(Post, post_id)
    if not p or p.is_removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "글을 찾을 수 없습니다.")
    if not db.scalar(select(PostScrap.id).where(PostScrap.post_id == post_id, PostScrap.user_id == user.id)):
        db.add(PostScrap(post_id=post_id, user_id=user.id))
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
    return ScrapStatus(scrapped=True)


@router.delete("/posts/{post_id}/scrap", response_model=ScrapStatus)
def unscrap_post(post_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    existing = db.scalar(select(PostScrap).where(PostScrap.post_id == post_id, PostScrap.user_id == user.id))
    if existing:
        db.delete(existing)
        db.commit()
    return ScrapStatus(scrapped=False)
