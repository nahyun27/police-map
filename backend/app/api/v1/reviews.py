from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1._present import iso, ratings_dict
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.moderation import find_banned
from app.core.rate_limit import review_limiter
from app.core.security import hash_case_number
from app.models import Officer, Review, ReviewStatus, User
from app.schemas.review import MyReviewOut, ReviewCreate

router = APIRouter(prefix="/reviews", tags=["reviews"])


def _mine(r: Review) -> MyReviewOut:
    return MyReviewOut(
        id=r.id, officer_id=r.officer_id, officer_name=r.officer.name, status=r.status.value, reject_reason=r.reject_reason,
        ratings=ratings_dict(r), body=r.body, created_at=iso(r.created_at),
    )


@router.post("", response_model=MyReviewOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(review_limiter)])
def create_review(body: ReviewCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """평가 제출. 항상 '검수 대기'로 저장되며, 운영진 승인 전에는 어디에도 공개되지 않는다."""
    if settings.REQUIRE_IDENTITY_VERIFICATION and user.identity_verified_at is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "휴대폰 본인인증을 완료한 회원만 평가를 작성할 수 있습니다.")

    officer = db.get(Officer, body.officer_id)
    if not officer or not officer.is_visible:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "수사관을 찾을 수 없습니다.")

    banned = find_banned(body.body)
    if banned:
        raise HTTPException(
            422,
            {"message": "게시할 수 없는 표현이 포함되어 있습니다. 사실 중심으로 수정해 주세요.", "banned": banned},
        )

    case_hash = hash_case_number(body.case_number)
    dup = db.scalar(select(Review.id).where(
        Review.author_id == user.id, Review.officer_id == officer.id, Review.case_number_hash == case_hash
    ))
    if dup:
        raise HTTPException(status.HTTP_409_CONFLICT, "같은 사건으로 이미 이 수사관을 평가하셨습니다.")

    review = Review(
        officer_id=officer.id, author_id=user.id, role=body.role, case_type=body.case_type,
        case_number=body.case_number, case_number_hash=case_hash, body=body.body, status=ReviewStatus.pending,
        **body.ratings.model_dump(),
    )
    db.add(review)
    try:
        db.commit()
    except IntegrityError:  # 동시 요청으로 중복이 통과한 경우
        db.rollback()
        raise HTTPException(status.HTTP_409_CONFLICT, "같은 사건으로 이미 이 수사관을 평가하셨습니다.")
    return _mine(review)


@router.get("/mine", response_model=list[MyReviewOut])
def my_reviews(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Review).where(Review.author_id == user.id).order_by(Review.created_at.desc(), Review.id.desc())).all()
    return [_mine(r) for r in rows]
