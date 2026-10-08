from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.v1._present import reply_out, review_public
from app.core.database import get_db
from app.core.deps import get_current_user, get_current_user_optional
from app.core.moderation import find_banned
from app.core.rate_limit import comment_limiter, reply_limiter, review_limiter, vote_limiter
from app.core.security import hash_case_number
from app.models import (
    Review, ReviewComment, ReviewCommentVote, ReviewReply, ReviewScrap, ReviewStatus, ReviewVote, Station, User,
    UserRole,
)
from app.models.review import CASE_TYPE_LABELS, ROLE_LABELS
from app.schemas.community import CommentCreate, CommentOut, ScrapStatus, VoteIn, VoteSummary
from app.schemas.public import Page, RecentReview
from app.schemas.review import MyReviewOut, ReviewCreate, ReviewReceipt
from app.schemas.verification import ReplyCreate, ReplyOut
from app.services import takedown as takedown_svc
from app.services.audit import log_action
from app.services.engagement import ANON_LABEL, comment_counts, comment_tree, reply_rows, scrapped_set, vote_summaries
from app.services.ratings import DIMS, visible_reviews

router = APIRouter(prefix="/reviews", tags=["reviews"])


def _ratings_dict(r: Review) -> dict[str, int | None]:
    return {d: getattr(r, d) for d in DIMS}


def _overall(r: Review) -> float | None:
    vals = [v for v in _ratings_dict(r).values() if v is not None]
    return round(sum(vals) / len(vals), 1) if vals else None


def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


@router.get("/mine", response_model=Page[MyReviewOut])
def list_my_reviews(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    """로그인한 본인이 작성(author_id 연결)한 평가만 — 검수 대기·반려 포함 전부 보여준다.
    author_id 가 NULL 인(비로그인으로 낸) 평가는 계정과 연결되지 않으므로 여기 안 나온다."""
    base = Review.author_id == user.id
    total = db.scalar(select(func.count(Review.id)).where(base)) or 0
    rows = db.scalars(
        select(Review).options(joinedload(Review.station)).where(base)
        .order_by(Review.created_at.desc()).offset((page - 1) * size).limit(size)
    ).all()
    ids = [r.id for r in rows]
    votes = vote_summaries(db, ReviewVote, ReviewVote.review_id, ids, user.id)
    counts = comment_counts(db, ReviewComment, ReviewComment.review_id, ids)
    replies = reply_rows(db, ids)
    scrapped = scrapped_set(db, ReviewScrap, ReviewScrap.review_id, ids, user.id)
    items = [
        MyReviewOut(
            id=r.id, station_id=r.station_id, station_name=r.station.name,
            role=r.role.value, role_label=ROLE_LABELS[r.role], case_type=r.case_type.value, case_type_label=CASE_TYPE_LABELS[r.case_type],
            ratings=_ratings_dict(r), overall=_overall(r), body=r.body, status=r.status.value, reject_reason=r.reject_reason,
            created_at=_iso(r.created_at), published_at=_iso(r.published_at),
            comment_count=counts[r.id], score=votes[r.id].score,
            evidence_note=r.evidence_note, evidence_verified=r.evidence_verified,
            reply=reply_out(*replies[r.id], user.id) if r.id in replies else None,
            is_scrapped=r.id in scrapped,
        )
        for r in rows
    ]
    return Page(items=items, total=total, page=page, size=size)


@router.get("/scraps", response_model=Page[RecentReview])
def list_my_scraps(
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=50),
    user: User = Depends(get_current_user), db: Session = Depends(get_db),
):
    """내가 스크랩한 평가 목록(최신 스크랩순). 평가가 사후에 삭제되면 스크랩도 같이 사라진다
    (FK CASCADE 가 아니라 애플리케이션 레벨로, visible_reviews 필터에서 자연히 제외된다)."""
    q = (
        select(ReviewScrap.review_id, ReviewScrap.created_at)
        .where(ReviewScrap.user_id == user.id).order_by(ReviewScrap.created_at.desc(), ReviewScrap.id.desc())
    )
    scrap_rows = db.execute(q).all()
    ordered_ids = [rid for rid, _ in scrap_rows]
    total = len(ordered_ids)
    page_ids = ordered_ids[(page - 1) * size: (page - 1) * size + size]
    if not page_ids:
        return Page(items=[], total=total, page=page, size=size)

    rows = db.execute(
        visible_reviews(Review, Station).join(Station, Station.id == Review.station_id).where(Review.id.in_(page_ids))
    ).all()
    by_id = {r.id: (r, s) for r, s in rows}
    votes = vote_summaries(db, ReviewVote, ReviewVote.review_id, page_ids, user.id)
    counts = comment_counts(db, ReviewComment, ReviewComment.review_id, page_ids)
    replies = reply_rows(db, page_ids)
    items = []
    for rid in page_ids:  # 스크랩한 순서 유지(삭제된 평가는 조용히 건너뜀)
        if rid not in by_id:
            continue
        r, s = by_id[rid]
        items.append(RecentReview(
            **review_public(
                r, votes[rid], counts[rid], reply_out(*replies[rid], user.id) if rid in replies else None, True,
            ).model_dump(),
            station_id=s.id, station_name=s.name,
        ))
    return Page(items=items, total=total, page=page, size=size)


@router.post("/{review_id}/scrap", response_model=ScrapStatus, dependencies=[Depends(vote_limiter)])
def scrap_review(review_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _published_or_404(db, review_id)
    if not db.scalar(select(ReviewScrap.id).where(ReviewScrap.review_id == review_id, ReviewScrap.user_id == user.id)):
        db.add(ReviewScrap(review_id=review_id, user_id=user.id))
        try:
            db.commit()
        except IntegrityError:  # 동시 요청으로 중복 등록된 경우 — 이미 스크랩된 것으로 취급
            db.rollback()
    return ScrapStatus(scrapped=True)


@router.delete("/{review_id}/scrap", response_model=ScrapStatus, dependencies=[Depends(vote_limiter)])
def unscrap_review(review_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    existing = db.scalar(select(ReviewScrap).where(ReviewScrap.review_id == review_id, ReviewScrap.user_id == user.id))
    if existing:
        db.delete(existing)
        db.commit()
    return ScrapStatus(scrapped=False)


@router.post("", response_model=ReviewReceipt, status_code=status.HTTP_201_CREATED, dependencies=[Depends(review_limiter)])
def create_review(body: ReviewCreate, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    """평가 제출. 로그인 없이도 익명으로 작성 가능하고, 2026-10 결정으로 사전 검수 없이 즉시
    게시된다(게시판과 동일한 방식 — 명예훼손 등 게시물 책임은 작성자 본인이 진다). 금칙어
    자동 필터만 1차로 걸러내고, 문제가 생기면 관리자가 사후 삭제하거나 당사자가 삭제·정정
    요청을 넣을 수 있다. 남용 방지는 IP 기준 속도 제한으로 한다.
    로그인한 상태로 제출하면 author_id 가 채워져 본인 계정의 "내가 쓴 글"에서 보인다 — 단,
    공개 화면에는 어느 쪽이든 작성자 신원이 절대 드러나지 않는다(역할 라벨만 표시)."""
    station = db.get(Station, body.station_id)
    if not station:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "경찰서를 찾을 수 없습니다.")

    banned = find_banned(body.body)
    if banned:
        raise HTTPException(
            422,
            {"message": "게시할 수 없는 표현이 포함되어 있습니다. 사실 중심으로 수정해 주세요.", "banned": banned},
        )

    # 사건번호는 선택 입력이라, 입력한 경우에만 같은 경찰서 내 중복 제출을 막는다.
    case_hash = hash_case_number(body.case_number) if body.case_number else None
    if case_hash:
        dup = db.scalar(select(Review.id).where(Review.station_id == station.id, Review.case_number_hash == case_hash))
        if dup:
            raise HTTPException(status.HTTP_409_CONFLICT, "같은 사건번호로 이미 제출된 평가가 있습니다.")

    now = takedown_svc.utcnow()
    review = Review(
        station_id=station.id, author_id=user.id if user else None, role=body.role, case_type=body.case_type,
        case_number=body.case_number, case_number_hash=case_hash, body=body.body,
        evidence_note=body.evidence_note, status=ReviewStatus.published, published_at=now,
        **body.ratings.model_dump(),
    )
    db.add(review)
    try:
        db.commit()
    except IntegrityError:  # 동시 요청으로 중복이 통과한 경우
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "같은 사건번호로 이미 제출된 평가가 있습니다.")
    return ReviewReceipt(id=review.id, status=review.status.value, message="게시되었습니다.")


def _published_or_404(db: Session, review_id: int) -> Review:
    r = db.get(Review, review_id)
    if not r or r.status != ReviewStatus.published:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "평가를 찾을 수 없습니다.")
    return r


@router.get("/{review_id}/comments", response_model=list[CommentOut])
def list_review_comments(
    review_id: int, sort: str = Query("new", pattern="^(new|top)$"),
    db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional),
):
    _published_or_404(db, review_id)
    rows = [
        (c, nickname or ANON_LABEL)
        for c, nickname in db.execute(
            select(ReviewComment, User.nickname).outerjoin(User, User.id == ReviewComment.author_id)
            .where(ReviewComment.review_id == review_id).order_by(ReviewComment.created_at.asc())
        ).all()
    ]
    ids = [c.id for c, _ in rows]
    votes = vote_summaries(db, ReviewCommentVote, ReviewCommentVote.comment_id, ids, user.id if user else None)
    return comment_tree(rows, user.id if user else None, votes, sort)


@router.post(
    "/{review_id}/comments", response_model=CommentOut, status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(comment_limiter)],
)
def create_review_comment(
    review_id: int, body: CommentCreate, db: Session = Depends(get_db),
    user: User | None = Depends(get_current_user_optional),
):
    """평가(리뷰)·게시글과 마찬가지로 로그인 없이도 익명으로 댓글을 달 수 있다(2026-10 결정) —
    추천/투표와 달리 댓글은 신뢰도 핵심 지표가 아니라서 글 작성과 같은 기준으로 맞췄다."""
    _published_or_404(db, review_id)
    banned = find_banned(body.body)
    if banned:
        raise HTTPException(422, {"message": "게시할 수 없는 표현이 포함되어 있습니다.", "banned": banned})
    parent = None
    if body.parent_id is not None:
        parent = db.get(ReviewComment, body.parent_id)
        if not parent or parent.review_id != review_id:
            raise HTTPException(status.HTTP_404_NOT_FOUND, "댓글을 찾을 수 없습니다.")
        if parent.parent_id is not None:
            raise HTTPException(422, "대댓글에는 답글을 달 수 없습니다.")
    comment = ReviewComment(review_id=review_id, author_id=user.id if user else None, parent_id=body.parent_id, body=body.body)
    db.add(comment)
    db.commit()
    uid = user.id if user else None
    return comment_tree([(comment, user.nickname if user else ANON_LABEL)], uid)[0]


@router.delete("/comments/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_review_comment(comment_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    comment = db.get(ReviewComment, comment_id)
    if not comment or comment.is_removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "댓글을 찾을 수 없습니다.")
    if comment.author_id != user.id and user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "본인 댓글만 삭제할 수 있습니다.")
    comment.is_removed = True
    comment.removed_at = takedown_svc.utcnow()
    log_action(db, user.id, "comment.remove", "review_comment", comment.id, {"self": comment.author_id == user.id})
    db.commit()


@router.post("/comments/{comment_id}/vote", response_model=VoteSummary, dependencies=[Depends(vote_limiter)])
def vote_review_comment(comment_id: int, body: VoteIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    comment = db.get(ReviewComment, comment_id)
    if not comment or comment.is_removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "댓글을 찾을 수 없습니다.")
    existing = db.scalar(select(ReviewCommentVote).where(ReviewCommentVote.comment_id == comment_id, ReviewCommentVote.user_id == user.id))
    if body.value == 0:
        if existing:
            db.delete(existing)
    elif existing:
        existing.value = body.value
    else:
        db.add(ReviewCommentVote(comment_id=comment_id, user_id=user.id, value=body.value))
    db.commit()
    return vote_summaries(db, ReviewCommentVote, ReviewCommentVote.comment_id, [comment_id], user.id)[comment_id]


@router.post("/{review_id}/vote", response_model=VoteSummary, dependencies=[Depends(vote_limiter)])
def vote_review(review_id: int, body: VoteIn, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    _published_or_404(db, review_id)
    existing = db.scalar(select(ReviewVote).where(ReviewVote.review_id == review_id, ReviewVote.user_id == user.id))
    if body.value == 0:
        if existing:
            db.delete(existing)
    elif existing:
        existing.value = body.value
    else:
        db.add(ReviewVote(review_id=review_id, user_id=user.id, value=body.value))
    db.commit()
    return vote_summaries(db, ReviewVote, ReviewVote.review_id, [review_id], user.id)[review_id]


def _require_officer(user: User, station_id: int) -> None:
    if user.officer_station_id != station_id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "해당 경찰서 소속으로 인증된 계정만 해명을 작성할 수 있습니다.")


@router.post(
    "/{review_id}/reply", response_model=ReplyOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(reply_limiter)],
)
def create_reply(review_id: int, body: ReplyCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """인증된 경찰관(본인 소속 경찰서 리뷰 한정)이 다는 공식 해명. 리뷰 1건당 1개만 허용된다."""
    review = _published_or_404(db, review_id)
    _require_officer(user, review.station_id)
    banned = find_banned(body.body)
    if banned:
        raise HTTPException(422, {"message": "게시할 수 없는 표현이 포함되어 있습니다.", "banned": banned})
    if db.scalar(select(ReviewReply.id).where(ReviewReply.review_id == review_id)):
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 해명이 등록된 평가입니다.")
    reply = ReviewReply(review_id=review_id, author_id=user.id, body=body.body, show_name=body.show_name)
    db.add(reply)
    try:
        db.commit()
    except IntegrityError:  # 동시 요청으로 중복 등록된 경우
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 해명이 등록된 평가입니다.")
    return reply_out(reply, user, user.id)


@router.patch("/{review_id}/reply", response_model=ReplyOut, dependencies=[Depends(reply_limiter)])
def update_reply(review_id: int, body: ReplyCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    review = _published_or_404(db, review_id)
    reply = db.scalar(select(ReviewReply).where(ReviewReply.review_id == review_id))
    if not reply:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "해명을 찾을 수 없습니다.")
    if reply.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "본인이 작성한 해명만 수정할 수 있습니다.")
    # 작성 당시엔 인증돼 있었어도 그 사이 인증이 취소·만료됐을 수 있으니 수정 시점에도 다시 확인한다
    # (관리자가 인증을 취소하면 해당 해명은 즉시 삭제되므로 보통은 여기 닿지 않지만, 방어적으로 둔다).
    _require_officer(user, review.station_id)
    banned = find_banned(body.body)
    if banned:
        raise HTTPException(422, {"message": "게시할 수 없는 표현이 포함되어 있습니다.", "banned": banned})
    reply.body, reply.show_name, reply.updated_at = body.body, body.show_name, takedown_svc.utcnow()
    db.commit()
    return reply_out(reply, user, user.id)


@router.delete("/{review_id}/reply", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(reply_limiter)])
def delete_reply(review_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """작성자 본인 또는 관리자만 삭제 가능. 하드 삭제라(모델 docstring 참고) 삭제 후 다른
    인증된 경찰관이 새로 해명을 달 수 있다."""
    reply = db.scalar(select(ReviewReply).where(ReviewReply.review_id == review_id))
    if not reply:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "해명을 찾을 수 없습니다.")
    if reply.author_id != user.id and user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "본인 해명만 삭제할 수 있습니다.")
    log_action(db, user.id, "reply.remove", "review_reply", reply.id, {"self": reply.author_id == user.id})
    db.delete(reply)
    db.commit()
