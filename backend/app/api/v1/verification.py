from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.rate_limit import verify_limiter
from app.models import OfficerVerification, Station, User, VerificationStatus
from app.schemas.verification import VerifyCreate, VerifyOut

router = APIRouter(prefix="/officer-verifications", tags=["officer-verification"])


def _out(v: OfficerVerification) -> VerifyOut:
    return VerifyOut(
        id=v.id, station_id=v.station_id, station_name=v.station.name, name=v.name, rank=v.rank,
        department=v.department, contact=v.contact, proof_note=v.proof_note, status=v.status.value,
        reject_reason=v.reject_reason, created_at=v.created_at.isoformat() if v.created_at else None,
    )


@router.get("/mine", response_model=list[VerifyOut])
def list_my_verifications(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.scalars(
        select(OfficerVerification).where(OfficerVerification.user_id == user.id)
        .order_by(OfficerVerification.created_at.desc())
    ).all()
    return [_out(v) for v in rows]


@router.post("", response_model=VerifyOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(verify_limiter)])
def create_verification(body: VerifyCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """경찰관 신원 인증 신청. 관리자가 수동 심사한다(core.rate_limit.verify_limiter 로 스팸 방지:
    하루 3건). 이미 인증된 계정이거나 심사 대기 중인 신청이 있으면 다시 신청할 수 없다."""
    if user.officer_station_id is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 경찰관 인증이 완료된 계정입니다.")
    pending = db.scalar(
        select(OfficerVerification.id).where(
            OfficerVerification.user_id == user.id, OfficerVerification.status == VerificationStatus.pending,
        )
    )
    if pending:
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 심사 대기 중인 신청이 있습니다.")
    station = db.get(Station, body.station_id)
    if not station:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "경찰서를 찾을 수 없습니다.")
    v = OfficerVerification(
        user_id=user.id, station_id=body.station_id, name=body.name, rank=body.rank,
        department=body.department, contact=body.contact, proof_note=body.proof_note,
    )
    db.add(v)
    db.commit()
    return _out(v)
