"""삭제·정정 요청 처리: 접수 즉시 임시조치(블라인드), 재검토 결과에 따른 복원 또는 삭제."""
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import (
    CaseStatus, Officer, PublicCase, Review, ReviewStatus, TakedownRequest, TakedownStatus, TakedownTarget, User,
)

TAKEDOWN_BLIND_REASON = "당사자의 삭제·정정 요청이 접수되어 임시조치(블라인드)되었습니다. 운영진이 재검토합니다."
from app.services.audit import log_action


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def new_public_code() -> str:
    return secrets.token_urlsafe(16)


def _target(db: Session, req: TakedownRequest) -> Review | Officer | PublicCase | None:
    if req.target_type == TakedownTarget.review:
        return db.get(Review, req.review_id)
    if req.target_type == TakedownTarget.public_case:
        return db.get(PublicCase, req.case_id)
    return db.get(Officer, req.officer_id)


def blind(db: Session, req: TakedownRequest) -> None:
    """임시조치. 이미 비공개(대기·반려·삭제) 상태인 평가는 건드리지 않는다."""
    target = _target(db, req)
    if isinstance(target, Review) and target.status == ReviewStatus.published:
        target.blinded_from_status = target.status
        target.status = ReviewStatus.blinded
        target.blind_reason = TAKEDOWN_BLIND_REASON
    elif isinstance(target, Review) and target.status == ReviewStatus.blinded:
        # 이미 (신고 누적 등으로) 블라인드돼 있어도 사유를 삭제·정정 요청으로 바꿔 둔다 — 그래야 신고가
        # 기각돼도 "신고 누적 자동 블라인드"로 오인해 요청 처리 전에 다시 공개되는 일이 없다.
        target.blind_reason = TAKEDOWN_BLIND_REASON
    elif isinstance(target, PublicCase) and target.status in (CaseStatus.published, CaseStatus.held):
        target.blinded_from_status, target.status = target.status, CaseStatus.blinded
        target.blind_reason, target.blinded_at = TAKEDOWN_BLIND_REASON, utcnow()
    elif isinstance(target, PublicCase) and target.status == CaseStatus.blinded:
        target.blind_reason = TAKEDOWN_BLIND_REASON
    elif isinstance(target, Officer):
        target.is_blinded = True


def create_request(db: Session, **fields) -> TakedownRequest:
    req = TakedownRequest(
        public_code=new_public_code(),
        status=TakedownStatus.pending,
        due_at=utcnow() + timedelta(days=settings.TAKEDOWN_REVIEW_DAYS),
        **fields,
    )
    db.add(req)
    db.flush()
    blind(db, req)
    log_action(db, None, "takedown_received", "takedown_request", req.id, {
        "target_type": req.target_type.value, "review_id": req.review_id, "officer_id": req.officer_id, "case_id": req.case_id,
        "request_type": req.request_type.value,
    })
    return req


def _same_target_pending(db: Session, req: TakedownRequest) -> list[TakedownRequest]:
    q = select(TakedownRequest).where(TakedownRequest.status == TakedownStatus.pending, TakedownRequest.id != req.id)
    if req.target_type == TakedownTarget.review:
        q = q.where(TakedownRequest.review_id == req.review_id)
    elif req.target_type == TakedownTarget.public_case:
        q = q.where(TakedownRequest.case_id == req.case_id)
    else:
        q = q.where(TakedownRequest.officer_id == req.officer_id)
    return list(db.scalars(q))


def _close(db: Session, req: TakedownRequest, status: TakedownStatus, admin: User, note: str) -> None:
    req.status = status
    req.resolved_at = utcnow()
    req.resolved_by = admin.id
    req.resolution_note = note
    log_action(db, admin.id, f"takedown_{status.value}", "takedown_request", req.id, {"note": note})


def resolve_keep(db: Session, req: TakedownRequest, admin: User, note: str) -> None:
    """게시 유지. 같은 대상에 다른 대기 요청이 남아 있으면 임시조치는 유지한다."""
    _close(db, req, TakedownStatus.kept, admin, note)
    if _same_target_pending(db, req):
        return
    target = _target(db, req)
    if isinstance(target, Review) and target.status == ReviewStatus.blinded:
        target.status = target.blinded_from_status or ReviewStatus.published
        target.blinded_from_status = None
        target.blind_reason = None
    elif isinstance(target, PublicCase) and target.status == CaseStatus.blinded:
        target.status = target.blinded_from_status or CaseStatus.published
        target.blinded_from_status, target.blind_reason, target.blinded_at = None, None, None
    elif isinstance(target, Officer):
        target.is_blinded = False


def resolve_remove(db: Session, req: TakedownRequest, admin: User, note: str) -> None:
    """삭제 확정. 같은 대상의 다른 대기 요청도 함께 종결한다."""
    others = _same_target_pending(db, req)
    _close(db, req, TakedownStatus.removed, admin, note)
    for other in others:
        _close(db, other, TakedownStatus.removed, admin, f"동일 대상 삭제로 종결 (요청 #{req.id})")
    target = _target(db, req)
    if isinstance(target, Review):
        target.status = ReviewStatus.removed
        target.blinded_from_status = None
    elif isinstance(target, PublicCase):
        target.status, target.blinded_from_status = CaseStatus.removed, None
        target.removed_reason = "삭제·정정 요청에 따른 삭제"
    elif isinstance(target, Officer):
        target.is_published = False
        target.is_blinded = False
