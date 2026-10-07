from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, get_current_user_optional
from app.core.moderation import find_banned
from app.core.rate_limit import review_limiter
from app.core.security import hash_case_number
from app.models import Review, ReviewStatus, Station, User
from app.models.review import CASE_TYPE_LABELS, ROLE_LABELS
from app.schemas.public import Page
from app.schemas.review import MyReviewOut, ReviewCreate, ReviewReceipt
from app.services.ratings import DIMS

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
        select(Review).where(base).order_by(Review.created_at.desc()).offset((page - 1) * size).limit(size)
    ).all()
    items = [
        MyReviewOut(
            id=r.id, station_id=r.station_id, station_name=r.station.name,
            role=r.role.value, role_label=ROLE_LABELS[r.role], case_type=r.case_type.value, case_type_label=CASE_TYPE_LABELS[r.case_type],
            ratings=_ratings_dict(r), overall=_overall(r), body=r.body, status=r.status.value, reject_reason=r.reject_reason,
            created_at=_iso(r.created_at), published_at=_iso(r.published_at),
        )
        for r in rows
    ]
    return Page(items=items, total=total, page=page, size=size)


@router.post("", response_model=ReviewReceipt, status_code=status.HTTP_201_CREATED, dependencies=[Depends(review_limiter)])
def create_review(body: ReviewCreate, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional)):
    """평가 제출. 로그인 없이도 익명으로 작성 가능하고, 항상 '검수 대기'로 저장된다.
    운영진 승인 전에는 어디에도 공개되지 않는다. 남용 방지는 IP 기준 속도 제한으로만 한다.
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

    review = Review(
        station_id=station.id, author_id=user.id if user else None, role=body.role, case_type=body.case_type,
        case_number=body.case_number, case_number_hash=case_hash, body=body.body, status=ReviewStatus.pending,
        **body.ratings.model_dump(),
    )
    db.add(review)
    try:
        db.commit()
    except IntegrityError:  # 동시 요청으로 중복이 통과한 경우
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "같은 사건번호로 이미 제출된 평가가 있습니다.")
    return ReviewReceipt(id=review.id, status=review.status.value, message="접수되었습니다. 검수(24~48시간) 후 게시됩니다.")
