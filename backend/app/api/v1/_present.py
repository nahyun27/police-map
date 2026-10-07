"""ORM 객체 → 응답 스키마 변환. 공개 응답에는 사건번호·요청자 연락처를 절대 넣지 않는다."""
from app.models import Review, ReviewReply, User
from app.models.review import CASE_TYPE_LABELS, ROLE_LABELS
from app.schemas.community import VoteSummary
from app.schemas.public import ReviewPublic
from app.schemas.verification import ReplyOut
from app.services.ratings import DIMS

_EMPTY_VOTE = VoteSummary(up=0, down=0, score=0, my_vote=0)


def ratings_dict(r: Review) -> dict[str, int | None]:
    return {d: getattr(r, d) for d in DIMS}


def review_overall(r: Review) -> float | None:
    vals = [v for v in ratings_dict(r).values() if v is not None]
    return round(sum(vals) / len(vals), 1) if vals else None


def iso(dt) -> str | None:
    return dt.isoformat() if dt else None


def reply_out(reply: ReviewReply, author: User | None, viewer_id: int | None) -> ReplyOut:
    """author 가 None(드문 경우 — 인증이 사후에 해제됨)이면 일반 명칭으로 대체한다."""
    if author and reply.show_name:
        label = author.officer_name or "경찰관"
    elif author:
        label = " ".join(filter(None, [author.officer_rank, f"({author.officer_department})" if author.officer_department else None])) or "경찰관"
    else:
        label = "경찰관(인증 해제됨)"
    return ReplyOut(
        id=reply.id, review_id=reply.review_id, author_label=label, show_name=reply.show_name,
        is_mine=(viewer_id is not None and reply.author_id == viewer_id),
        body=reply.body, created_at=iso(reply.created_at), updated_at=iso(reply.updated_at),
    )


def review_public(
    r: Review, vote: VoteSummary = _EMPTY_VOTE, comment_count: int = 0, reply: ReplyOut | None = None,
    is_scrapped: bool = False,
) -> ReviewPublic:
    return ReviewPublic(
        id=r.id, role=r.role.value, role_label=ROLE_LABELS[r.role], case_type=r.case_type.value,
        case_type_label=CASE_TYPE_LABELS[r.case_type], ratings=ratings_dict(r), overall=review_overall(r),
        body=r.body, published_at=iso(r.published_at),
        comment_count=comment_count, score=vote.score, my_vote=vote.my_vote, evidence_verified=r.evidence_verified,
        reply=reply, is_scrapped=is_scrapped,
    )
