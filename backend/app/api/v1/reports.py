from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.rate_limit import report_limiter
from app.models import Report, ReportStatus, User
from app.schemas.report import ReportCreate, ReportReceipt
from app.services.reports import get_target

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("", response_model=ReportReceipt, status_code=status.HTTP_201_CREATED, dependencies=[Depends(report_limiter)])
def create_report(body: ReportCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """평가·게시판 글·댓글·해명 신고. 관리자가 사후에 삭제하거나 기각한다(기존 관리자 주도
    사후삭제와 별개로, 이용자가 직접 문제를 지적해 큐에 올리는 경로)."""
    if not get_target(db, body.target_type, body.target_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "신고 대상을 찾을 수 없습니다.")
    existing = db.scalar(
        select(Report.id).where(
            Report.reporter_id == user.id, Report.target_type == body.target_type, Report.target_id == body.target_id,
            Report.status == ReportStatus.pending,
        )
    )
    if existing:
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 신고 접수된 항목입니다.")
    report = Report(reporter_id=user.id, target_type=body.target_type, target_id=body.target_id, reason=body.reason)
    db.add(report)
    db.commit()
    return ReportReceipt(id=report.id, message="신고가 접수되었습니다. 운영진이 검토합니다.")
