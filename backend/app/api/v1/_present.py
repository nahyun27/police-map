"""ORM 객체 → 응답 스키마 변환. 공개 응답에는 사건번호·요청자 연락처를 절대 넣지 않는다."""
from app.models import Review
from app.models.review import CASE_TYPE_LABELS, ROLE_LABELS
from app.schemas.public import ReviewPublic
from app.services.ratings import DIMS


def ratings_dict(r: Review) -> dict[str, int | None]:
    return {d: getattr(r, d) for d in DIMS}


def review_overall(r: Review) -> float | None:
    vals = [v for v in ratings_dict(r).values() if v is not None]
    return round(sum(vals) / len(vals), 1) if vals else None


def iso(dt) -> str | None:
    return dt.isoformat() if dt else None


def review_public(r: Review) -> ReviewPublic:
    return ReviewPublic(
        id=r.id, role=r.role.value, role_label=ROLE_LABELS[r.role], case_type=r.case_type.value,
        case_type_label=CASE_TYPE_LABELS[r.case_type], ratings=ratings_dict(r), overall=review_overall(r),
        body=r.body, published_at=iso(r.published_at),
    )
