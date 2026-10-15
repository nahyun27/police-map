"""게시물 블라인드(임시 비공개) 공통 규칙 — 평가·게시판 글·사건 공론화 세 종류에 똑같이 적용한다.

2026-10 의뢰인 결정:
- 모든 게시물에 신고 버튼. 서로 다른 회원의 미처리 신고가 AUTO_BLIND_THRESHOLD(5)건 이상 쌓이면
  자동 블라인드.
- 심각한 경우 관리자가 신고 수와 상관없이 즉시 수동 블라인드할 수 있다.
- 블라인드된 글은 공개 화면에서 사라지지만 삭제가 아니라 되돌릴 수 있고, 작성자 본인에게는
  마이페이지에서 "블라인드" 상태와 사유가 보인다.

댓글·해명은 "게시물"이 아니라서 여기 포함하지 않는다 — 신고하면 관리자 큐로만 간다."""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import CaseStatus, Post, PublicCase, Report, ReportStatus, ReportTarget, Review, ReviewStatus
from app.services.audit import log_action
from app.services.takedown import utcnow

AUTO_BLIND_THRESHOLD = 5
REASON_AUTO = "신고가 누적되어 자동으로 블라인드되었습니다. 운영진이 검토합니다."
REASON_ADMIN_DEFAULT = "운영진이 운영원칙 위반 소지가 있어 블라인드했습니다."

BLINDABLE = (ReportTarget.review, ReportTarget.post, ReportTarget.public_case)
_MODEL = {ReportTarget.review: Review, ReportTarget.post: Post, ReportTarget.public_case: PublicCase}


def get(db: Session, target_type: ReportTarget, target_id: int):
    return db.get(_MODEL[target_type], target_id)


def is_blinded(obj) -> bool:
    if isinstance(obj, Review):
        return obj.status == ReviewStatus.blinded
    if isinstance(obj, Post):
        return obj.is_blinded
    return obj.status == CaseStatus.blinded


def _is_live(obj) -> bool:
    """블라인드 대상이 될 수 있는 상태인지(이미 삭제됐거나 비공개 대기 중인 평가는 건드리지 않는다)."""
    if isinstance(obj, Review):
        return obj.status == ReviewStatus.published
    if isinstance(obj, Post):
        return not obj.is_removed and not obj.is_blinded
    return obj.status in (CaseStatus.published, CaseStatus.held)


def blind(db: Session, obj, reason: str, actor_id: int | None) -> bool:
    if not _is_live(obj):
        return False
    if isinstance(obj, Review):
        obj.blinded_from_status, obj.status = obj.status, ReviewStatus.blinded
        obj.blind_reason = reason
        kind = "review"
    elif isinstance(obj, Post):
        obj.is_blinded, obj.blind_reason, obj.blinded_at = True, reason, utcnow()
        kind = "post"
    else:
        obj.blinded_from_status, obj.status = obj.status, CaseStatus.blinded
        obj.blind_reason, obj.blinded_at = reason, utcnow()
        kind = "public_case"
    log_action(db, actor_id, "blind.auto" if actor_id is None else "blind.admin", kind, obj.id, {"reason": reason})
    return True


def unblind(db: Session, obj, actor_id: int | None) -> bool:
    if not is_blinded(obj):
        return False
    if isinstance(obj, Review):
        obj.status, obj.blinded_from_status = obj.blinded_from_status or ReviewStatus.published, None
        obj.blind_reason = None
        kind = "review"
    elif isinstance(obj, Post):
        obj.is_blinded, obj.blind_reason, obj.blinded_at = False, None, None
        kind = "post"
    else:
        obj.status, obj.blinded_from_status = obj.blinded_from_status or CaseStatus.published, None
        obj.blind_reason, obj.blinded_at = None, None
        kind = "public_case"
    log_action(db, actor_id, "unblind", kind, obj.id, {})
    return True


def has_pending_takedown(db: Session, obj) -> bool:
    """삭제·정정 요청이 처리 대기 중이면 블라인드는 그 요청 처리(유지/삭제)로만 풀어야 한다."""
    from app.models import TakedownRequest, TakedownStatus  # 순환 import 회피
    if isinstance(obj, Review):
        cond = TakedownRequest.review_id == obj.id
    elif isinstance(obj, PublicCase):
        cond = TakedownRequest.case_id == obj.id
    else:
        return False
    return bool(db.scalar(select(TakedownRequest.id).where(cond, TakedownRequest.status == TakedownStatus.pending).limit(1)))


def pending_reporter_count(db: Session, target_type: ReportTarget, target_id: int) -> int:
    return db.scalar(
        select(func.count(func.distinct(Report.reporter_id))).where(
            Report.target_type == target_type, Report.target_id == target_id, Report.status == ReportStatus.pending,
        )
    ) or 0


def maybe_auto_blind(db: Session, target_type: ReportTarget, target_id: int) -> bool:
    """신고 접수 직후 호출. 미처리 신고자가 기준 이상이면 자동 블라인드."""
    if target_type not in BLINDABLE:
        return False
    if pending_reporter_count(db, target_type, target_id) < AUTO_BLIND_THRESHOLD:
        return False
    obj = get(db, target_type, target_id)
    return bool(obj) and blind(db, obj, REASON_AUTO, None)


def maybe_restore_after_dismiss(db: Session, target_type: ReportTarget, target_id: int) -> bool:
    """관리자가 신고를 기각했을 때, 남은 미처리 신고가 없고 '신고 누적 자동 블라인드' 상태였다면
    다시 공개한다. 관리자가 직접 건 블라인드나 삭제·정정 요청 임시조치는 그대로 둔다."""
    if target_type not in BLINDABLE or pending_reporter_count(db, target_type, target_id) > 0:
        return False
    obj = get(db, target_type, target_id)
    if obj and is_blinded(obj) and obj.blind_reason == REASON_AUTO and not has_pending_takedown(db, obj):
        return unblind(db, obj, None)
    return False
