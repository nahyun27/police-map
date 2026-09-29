from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.moderation import find_banned
from app.core.rate_limit import review_limiter
from app.core.security import hash_case_number
from app.models import Review, ReviewStatus, Station
from app.schemas.review import ReviewCreate, ReviewReceipt

router = APIRouter(prefix="/reviews", tags=["reviews"])


@router.post("", response_model=ReviewReceipt, status_code=status.HTTP_201_CREATED, dependencies=[Depends(review_limiter)])
def create_review(body: ReviewCreate, db: Session = Depends(get_db)):
    """평가 제출. 로그인 없이 익명으로 작성하며, 항상 '검수 대기'로 저장된다.
    운영진 승인 전에는 어디에도 공개되지 않는다. 남용 방지는 IP 기준 속도 제한으로만 한다."""
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
        station_id=station.id, role=body.role, case_type=body.case_type,
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
