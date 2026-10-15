"""관리자 API — 모든 엔드포인트는 admin 권한이 필요하고, 모든 조치는 감사 로그에 남는다."""
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.v1._present import iso, ratings_dict
from app.core.database import get_db
from app.core.deps import require_admin
from app.models import (
    CASE_CATEGORY_LABELS, AuditLog, CaseStatus, Department, Officer, OfficerAssignment, OfficerVerification, Post,
    PublicCase, Region, Report, ReportStatus, ReportTarget, Review, ReviewReply, ReviewStatus, Station, TakedownRequest,
    TakedownStatus, User, VerificationStatus,
)
from app.models.officer import SOURCE_LABELS
from app.models.review import case_type_label, role_label
from app.schemas.admin import EvidenceVerifyIn, OfficerCreate, OfficerUpdate, RejectIn, ResolveIn, StationCreate, UserStatsOut
from app.schemas.public import Page
from app.schemas.public_case import AdminCaseOut
from app.schemas.report import AdminReportOut, BlindedItemOut, BlindIn, ResolveReportIn
from app.schemas.verification import AdminVerifyOut
from app.services import takedown as takedown_svc
from app.services.audit import log_action
from app.services import blinding
from app.services.reports import batch_target_previews, remove_target, target_preview

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


# ---------- 가입 회원 통계 ----------
@router.get("/stats/users", response_model=UserStatsOut)
def user_stats(db: Session = Depends(get_db)):
    now = datetime.now(timezone.utc)
    d7, d30 = now - timedelta(days=7), now - timedelta(days=30)
    total = db.scalar(select(func.count(User.id))) or 0
    new_7d = db.scalar(select(func.count(User.id)).where(User.created_at >= d7)) or 0
    new_30d = db.scalar(select(func.count(User.id)).where(User.created_at >= d30)) or 0
    officer_verified = db.scalar(select(func.count(User.id)).where(User.officer_station_id.is_not(None))) or 0

    # 최근 14일 일별 가입 수 — 빈 날짜는 0으로 채운다(그래프에서 끊기지 않게).
    since = now - timedelta(days=13)
    day_col = func.date(User.created_at)
    rows = dict(db.execute(
        select(day_col, func.count(User.id)).where(User.created_at >= since).group_by(day_col)
    ).all())
    daily_signups = []
    for i in range(14):
        day = (since + timedelta(days=i)).date()
        count = rows.get(day) or rows.get(day.isoformat()) or 0
        daily_signups.append((day.isoformat(), int(count)))

    return UserStatsOut(total_users=total, new_7d=new_7d, new_30d=new_30d, officer_verified=officer_verified, daily_signups=daily_signups)


# ---------- 평가 검수 ----------
class AdminReview(BaseModel):
    id: int
    station_id: int
    station_name: str
    role: str
    role_label: str
    case_type: str
    case_type_label: str
    case_number: str | None  # 검증용 — 관리자에게만 노출. 선택 입력이라 없을 수 있음
    ratings: dict[str, int | None]
    body: str
    status: str
    reject_reason: str | None
    created_at: str | None
    evidence_note: str | None
    evidence_verified: bool
    target_label: str | None = None  # 관리자에게는 수사관 실명 그대로


def _admin_review(r: Review) -> AdminReview:
    return AdminReview(
        id=r.id, station_id=r.station_id, station_name=r.station.name,
        role=r.role.value, role_label=role_label(r), case_type=r.case_type.value, case_type_label=case_type_label(r),
        case_number=r.case_number, ratings=ratings_dict(r), body=r.body, status=r.status.value, reject_reason=r.reject_reason,
        created_at=iso(r.created_at), evidence_note=r.evidence_note, evidence_verified=r.evidence_verified,
        target_label=(
            f"{r.officer.name} {r.officer.rank}".strip() + (f" · {r.department.name}" if r.department else "")
            if r.officer else (r.department.name if r.department else None)
        ),
    )


@router.get("/reviews", response_model=Page[AdminReview])
def list_reviews(
    status_: ReviewStatus = Query(ReviewStatus.pending, alias="status"),
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db),
):
    total = db.scalar(select(func.count(Review.id)).where(Review.status == status_)) or 0
    # 검수 대기열은 오래된 순(먼저 제출한 사람부터), 그 외는 최신순
    order = Review.created_at.asc() if status_ == ReviewStatus.pending else Review.created_at.desc()
    rows = db.scalars(
        select(Review).options(joinedload(Review.station))
        .where(Review.status == status_).order_by(order, Review.id).offset((page - 1) * size).limit(size)
    ).all()
    return Page(items=[_admin_review(r) for r in rows], total=total, page=page, size=size)


def _pending_review(db: Session, review_id: int) -> Review:
    r = db.get(Review, review_id)
    if not r:
        raise HTTPException(404, "평가를 찾을 수 없습니다.")
    if r.status != ReviewStatus.pending:
        raise HTTPException(409, f"검수 대기 상태가 아닙니다(현재: {r.status.value}).")
    return r


@router.post("/reviews/{review_id}/approve", response_model=AdminReview)
def approve_review(review_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    r = _pending_review(db, review_id)
    now = takedown_svc.utcnow()
    r.status, r.reviewed_by, r.reviewed_at, r.published_at = ReviewStatus.published, admin.id, now, now
    log_action(db, admin.id, "review_approved", "review", r.id)
    db.commit()
    return _admin_review(r)


@router.post("/reviews/{review_id}/reject", response_model=AdminReview)
def reject_review(review_id: int, body: RejectIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    r = _pending_review(db, review_id)
    r.status, r.reviewed_by, r.reviewed_at, r.reject_reason = ReviewStatus.rejected, admin.id, takedown_svc.utcnow(), body.reason
    log_action(db, admin.id, "review_rejected", "review", r.id, {"reason": body.reason})
    db.commit()
    return _admin_review(r)


@router.post("/reviews/{review_id}/remove", response_model=AdminReview)
def remove_review(review_id: int, body: RejectIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """2026-10 결정 이후 즉시 게시된 평가를 운영자가 사후에 내리는 조치(게시판 글 삭제와 같은 성격).
    pending 대기열 건은 approve/reject 로 처리하므로 여기 대상이 아니다."""
    r = db.get(Review, review_id)
    if not r:
        raise HTTPException(404, "평가를 찾을 수 없습니다.")
    if r.status not in (ReviewStatus.published, ReviewStatus.blinded):
        raise HTTPException(409, f"사후 삭제 대상이 아닙니다(현재: {r.status.value}).")
    r.status, r.reviewed_by, r.reviewed_at, r.reject_reason = ReviewStatus.removed, admin.id, takedown_svc.utcnow(), body.reason
    log_action(db, admin.id, "review_removed_by_admin", "review", r.id, {"reason": body.reason})
    db.commit()
    return _admin_review(r)


@router.patch("/reviews/{review_id}/evidence", response_model=AdminReview)
def set_review_evidence(review_id: int, body: EvidenceVerifyIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """제출 시 작성자가 남긴 증빙 메모를 운영자가 실제로 확인했을 때만 켠다(공개 화면 "증빙확인" 배지).
    서류 자체를 플랫폼이 받는 기능은 아직 없다 — 별도 경로(이메일 등)로 확인했다는 전제."""
    r = db.get(Review, review_id)
    if not r:
        raise HTTPException(404, "평가를 찾을 수 없습니다.")
    r.evidence_verified = body.verified
    r.evidence_verified_by = admin.id if body.verified else None
    r.evidence_verified_at = takedown_svc.utcnow() if body.verified else None
    log_action(db, admin.id, "review_evidence_verified" if body.verified else "review_evidence_unverified", "review", r.id)
    db.commit()
    return _admin_review(r)


# ---------- 경찰관 신원 인증 ----------
def _admin_verify(v: OfficerVerification) -> AdminVerifyOut:
    return AdminVerifyOut(
        id=v.id, station_id=v.station_id, station_name=v.station.name, name=v.name, rank=v.rank,
        department=v.department, contact=v.contact, proof_note=v.proof_note, status=v.status.value,
        reject_reason=v.reject_reason, created_at=iso(v.created_at),
        user_id=v.user_id, user_email=v.user.email, user_nickname=v.user.nickname,
    )


@router.get("/officer-verifications", response_model=Page[AdminVerifyOut])
def list_officer_verifications(
    status_: VerificationStatus = Query(VerificationStatus.pending, alias="status"),
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db),
):
    total = db.scalar(select(func.count(OfficerVerification.id)).where(OfficerVerification.status == status_)) or 0
    order = OfficerVerification.created_at.asc() if status_ == VerificationStatus.pending else OfficerVerification.created_at.desc()
    rows = db.scalars(
        select(OfficerVerification).options(joinedload(OfficerVerification.station), joinedload(OfficerVerification.user))
        .where(OfficerVerification.status == status_)
        .order_by(order, OfficerVerification.id).offset((page - 1) * size).limit(size)
    ).all()
    return Page(items=[_admin_verify(v) for v in rows], total=total, page=page, size=size)


def _pending_verification(db: Session, verification_id: int) -> OfficerVerification:
    v = db.get(OfficerVerification, verification_id)
    if not v:
        raise HTTPException(404, "신청을 찾을 수 없습니다.")
    if v.status != VerificationStatus.pending:
        raise HTTPException(409, f"심사 대기 상태가 아닙니다(현재: {v.status.value}).")
    return v


@router.post("/officer-verifications/{verification_id}/approve", response_model=AdminVerifyOut)
def approve_verification(verification_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    v = _pending_verification(db, verification_id)
    now = takedown_svc.utcnow()
    v.status, v.reviewed_by, v.reviewed_at = VerificationStatus.approved, admin.id, now
    user = db.get(User, v.user_id)
    user.officer_station_id, user.officer_name = v.station_id, v.name
    user.officer_rank, user.officer_department, user.officer_verified_at = v.rank, v.department, now
    log_action(db, admin.id, "officer_verification_approved", "officer_verification", v.id, {"user_id": v.user_id})
    db.commit()
    return _admin_verify(v)


@router.post("/officer-verifications/{verification_id}/reject", response_model=AdminVerifyOut)
def reject_verification(verification_id: int, body: RejectIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    v = _pending_verification(db, verification_id)
    v.status, v.reviewed_by, v.reviewed_at, v.reject_reason = VerificationStatus.rejected, admin.id, takedown_svc.utcnow(), body.reason
    log_action(db, admin.id, "officer_verification_rejected", "officer_verification", v.id, {"reason": body.reason})
    db.commit()
    return _admin_verify(v)


@router.post("/officer-verifications/{verification_id}/revoke", response_model=AdminVerifyOut)
def revoke_verification(verification_id: int, body: RejectIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """이미 승인된 인증을 취소한다(전출·허위 신청 발각 등). 해당 계정의 해명 작성 권한이 즉시 사라지고,
    그 경찰서 소속으로 이미 써 둔 해명도 함께 삭제한다 — "검증된 경찰관의 공식 해명"이라는 신뢰가 깨진
    뒤에도 글만 남아 수정 가능한 상태로 방치되면 안 되기 때문이다(하드 삭제라 다른 인증된 경찰관이
    새로 해명을 달 수 있는 건 기존과 동일)."""
    v = db.get(OfficerVerification, verification_id)
    if not v or v.status != VerificationStatus.approved:
        raise HTTPException(404, "승인된 인증을 찾을 수 없습니다.")
    v.status, v.reviewed_by, v.reviewed_at, v.reject_reason = VerificationStatus.rejected, admin.id, takedown_svc.utcnow(), body.reason
    user = db.get(User, v.user_id)
    user.officer_station_id = user.officer_name = user.officer_rank = user.officer_department = user.officer_verified_at = None
    stale_replies = db.scalars(
        select(ReviewReply).join(Review, ReviewReply.review_id == Review.id)
        .where(ReviewReply.author_id == v.user_id, Review.station_id == v.station_id)
    ).all()
    for reply in stale_replies:
        log_action(db, admin.id, "reply.remove", "review_reply", reply.id, {"reason": "officer_verification_revoked"})
        db.delete(reply)
    log_action(db, admin.id, "officer_verification_revoked", "officer_verification", v.id, {"reason": body.reason, "user_id": v.user_id})
    db.commit()
    return _admin_verify(v)


# ---------- 신고 처리 ----------
def _admin_report(db: Session, r: Report, preview: str) -> AdminReportOut:
    blinded, auto = None, False
    if r.target_type in blinding.BLINDABLE:
        obj = blinding.get(db, r.target_type, r.target_id)
        blinded = blinding.is_blinded(obj) if obj else None
        auto = bool(blinded and obj.blind_reason == blinding.REASON_AUTO)
    return AdminReportOut(
        id=r.id, reporter_nickname=r.reporter.nickname, target_type=r.target_type.value, target_id=r.target_id,
        target_preview=preview, reason=r.reason, status=r.status.value,
        resolved_by=r.resolved_by, resolution_action=r.resolution_action, resolution_note=r.resolution_note,
        created_at=iso(r.created_at), target_blinded=blinded, target_blind_auto=auto,
        pending_reporters=blinding.pending_reporter_count(db, r.target_type, r.target_id),
    )


@router.get("/reports", response_model=Page[AdminReportOut])
def list_reports(
    status_: ReportStatus = Query(ReportStatus.pending, alias="status"),
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db),
):
    total = db.scalar(select(func.count(Report.id)).where(Report.status == status_)) or 0
    order = Report.created_at.asc() if status_ == ReportStatus.pending else Report.created_at.desc()
    rows = db.scalars(
        select(Report).options(joinedload(Report.reporter)).where(Report.status == status_)
        .order_by(order, Report.id).offset((page - 1) * size).limit(size)
    ).all()
    previews = batch_target_previews(db, rows)
    return Page(
        items=[_admin_report(db, r, previews[(r.target_type, r.target_id)]) for r in rows], total=total, page=page, size=size,
    )


@router.post("/reports/{report_id}/resolve", response_model=AdminReportOut)
def resolve_report(report_id: int, body: ResolveReportIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """action=remove 면 신고 대상을 실제로 지우고(콘텐츠 타입별 기존 삭제 방식 그대로),
    action=dismiss 면 내용은 그대로 두고 신고만 처리 완료로 닫는다.
    판단은 "그 게시물"에 대한 것이므로 같은 대상의 다른 미처리 신고도 함께 닫는다. 기각으로
    남은 신고가 없어지면 신고 누적 자동 블라인드는 풀린다(관리자 수동 블라인드는 유지)."""
    r = db.get(Report, report_id)
    if not r:
        raise HTTPException(404, "신고를 찾을 수 없습니다.")
    if r.status != ReportStatus.pending:
        raise HTTPException(409, f"이미 처리된 신고입니다(현재: {r.status.value}).")
    removed = remove_target(db, r.target_type, r.target_id, admin.id) if body.action == "remove" else False
    r.status = ReportStatus.resolved
    r.resolved_by, r.resolved_at = admin.id, takedown_svc.utcnow()
    r.resolution_action = "removed" if removed else "dismissed"
    r.resolution_note = body.note
    siblings = db.scalars(select(Report).where(
        Report.target_type == r.target_type, Report.target_id == r.target_id,
        Report.status == ReportStatus.pending, Report.id != r.id,
    )).all()
    for s in siblings:
        s.status, s.resolved_by, s.resolved_at = ReportStatus.resolved, admin.id, r.resolved_at
        s.resolution_action, s.resolution_note = r.resolution_action, f"동일 대상 일괄 처리 (신고 #{r.id})"
    db.flush()
    if r.resolution_action == "dismissed":
        blinding.maybe_restore_after_dismiss(db, r.target_type, r.target_id)
    log_action(
        db, admin.id, "report_resolved", "report", r.id,
        {"action": r.resolution_action, "target_type": r.target_type.value, "target_id": r.target_id,
         "siblings": [s.id for s in siblings]},
    )
    db.commit()
    return _admin_report(db, r, target_preview(db, r.target_type, r.target_id))


# ---------- 블라인드(평가·게시글·사건 공통) ----------
def _blindable_or_404(db: Session, target_type: ReportTarget, target_id: int):
    if target_type not in blinding.BLINDABLE:
        raise HTTPException(422, "평가·게시글·사건만 블라인드할 수 있습니다.")
    obj = blinding.get(db, target_type, target_id)
    if not obj:
        raise HTTPException(404, "대상을 찾을 수 없습니다.")
    return obj


@router.post("/blind", status_code=status.HTTP_204_NO_CONTENT)
def admin_blind(body: BlindIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """심각한 경우 신고 수와 상관없이 즉시 블라인드(2026-10 결정)."""
    obj = _blindable_or_404(db, body.target_type, body.target_id)
    if not blinding.blind(db, obj, (body.reason or "").strip() or blinding.REASON_ADMIN_DEFAULT, admin.id):
        raise HTTPException(409, "이미 블라인드됐거나 공개 상태가 아닌 게시물입니다.")
    db.commit()


@router.post("/unblind", status_code=status.HTTP_204_NO_CONTENT)
def admin_unblind(body: BlindIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    obj = _blindable_or_404(db, body.target_type, body.target_id)
    if blinding.has_pending_takedown(db, obj):
        raise HTTPException(409, "처리 대기 중인 삭제·정정 요청이 있습니다. 삭제·정정 요청 메뉴에서 유지/삭제로 처리해 주세요.")
    if not blinding.unblind(db, obj, admin.id):
        raise HTTPException(409, "블라인드 상태가 아닌 게시물입니다.")
    db.commit()


@router.get("/blinded", response_model=list[BlindedItemOut])
def list_blinded(db: Session = Depends(get_db)):
    """현재 블라인드된 평가·게시글·사건 전체(최근 것부터, 종류별 최대 200건)."""
    items: list[BlindedItemOut] = []

    def add(tt: ReportTarget, obj, title: str):
        items.append(BlindedItemOut(
            target_type=tt.value, target_id=obj.id, title=title, blind_reason=obj.blind_reason,
            is_auto=obj.blind_reason == blinding.REASON_AUTO,
            pending_reporters=blinding.pending_reporter_count(db, tt, obj.id),
        ))

    for rv in db.scalars(select(Review).where(Review.status == ReviewStatus.blinded).order_by(Review.id.desc()).limit(200)):
        add(ReportTarget.review, rv, (rv.body or "(서술 없음)")[:80])
    for p in db.scalars(select(Post).where(Post.is_blinded.is_(True), Post.is_removed.is_(False)).order_by(Post.id.desc()).limit(200)):
        add(ReportTarget.post, p, p.title)
    for c in db.scalars(select(PublicCase).where(PublicCase.status == CaseStatus.blinded).order_by(PublicCase.id.desc()).limit(200)):
        add(ReportTarget.public_case, c, c.title)
    return items


# ---------- 삭제·정정 요청 ----------
class AdminTakedown(BaseModel):
    id: int
    public_code: str
    target_type: str
    review_id: int | None
    officer_id: int | None
    case_id: int | None = None
    request_type: str
    requester_name: str
    requester_contact: str  # 처리 결과 통지용 — 관리자에게만 노출
    relation: str
    reason: str
    status: str
    created_at: str | None
    due_at: str | None
    overdue: bool  # 재검토 기한 초과
    resolved_at: str | None
    resolution_note: str | None


def _admin_takedown(t: TakedownRequest) -> AdminTakedown:
    due = t.due_at if t.due_at.tzinfo else t.due_at.replace(tzinfo=timezone.utc)  # SQLite 는 tz 를 잃는다
    overdue = t.status == TakedownStatus.pending and due < takedown_svc.utcnow()
    return AdminTakedown(
        id=t.id, public_code=t.public_code, target_type=t.target_type.value, review_id=t.review_id, officer_id=t.officer_id, case_id=t.case_id,
        request_type=t.request_type.value, requester_name=t.requester_name, requester_contact=t.requester_contact,
        relation=t.relation, reason=t.reason, status=t.status.value, created_at=iso(t.created_at), due_at=iso(t.due_at),
        overdue=overdue, resolved_at=iso(t.resolved_at), resolution_note=t.resolution_note,
    )


@router.get("/takedown-requests", response_model=Page[AdminTakedown])
def list_takedowns(
    status_: TakedownStatus = Query(TakedownStatus.pending, alias="status"),
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db),
):
    total = db.scalar(select(func.count(TakedownRequest.id)).where(TakedownRequest.status == status_)) or 0
    # 기한이 임박한 것부터
    rows = db.scalars(
        select(TakedownRequest).where(TakedownRequest.status == status_).order_by(TakedownRequest.due_at.asc(), TakedownRequest.id)
        .offset((page - 1) * size).limit(size)
    ).all()
    return Page(items=[_admin_takedown(t) for t in rows], total=total, page=page, size=size)


@router.post("/takedown-requests/{request_id}/resolve", response_model=AdminTakedown)
def resolve_takedown(request_id: int, body: ResolveIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    t = db.get(TakedownRequest, request_id)
    if not t:
        raise HTTPException(404, "요청을 찾을 수 없습니다.")
    if t.status != TakedownStatus.pending:
        raise HTTPException(409, "이미 처리된 요청입니다.")
    (takedown_svc.resolve_keep if body.decision == "keep" else takedown_svc.resolve_remove)(db, t, admin, body.note)
    db.flush()
    # 요청은 "게시 유지"로 끝났어도, 그 사이 쌓인 신고가 여전히 기준 이상이면 다시 자동 블라인드한다.
    if body.decision == "keep":
        if t.review_id:
            blinding.maybe_auto_blind(db, ReportTarget.review, t.review_id)
        elif t.case_id:
            blinding.maybe_auto_blind(db, ReportTarget.public_case, t.case_id)
    db.commit()
    return _admin_takedown(t)


# ---------- 경찰서·수사관 데이터 관리 ----------
class AdminOfficer(BaseModel):
    id: int
    station_id: int
    name: str
    rank: str
    department: str | None
    source: str
    source_label: str
    is_published: bool
    is_blinded: bool
    assignments: list[dict[str, str]]


def _admin_officer(o: Officer) -> AdminOfficer:
    return AdminOfficer(
        id=o.id, station_id=o.station_id, name=o.name, rank=o.rank, department=o.department.name if o.department else None,
        source=o.source.value, source_label=SOURCE_LABELS[o.source], is_published=o.is_published, is_blinded=o.is_blinded,
        assignments=[{"period": a.period, "description": a.description} for a in o.assignments],
    )


def _get_or_create_department(db: Session, station_id: int, name: str) -> Department:
    d = db.scalar(select(Department).where(Department.station_id == station_id, Department.name == name))
    if not d:
        d = Department(station_id=station_id, name=name)
        db.add(d)
        db.flush()
    return d


@router.post("/stations", status_code=status.HTTP_201_CREATED)
def create_station(body: StationCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if not db.get(Region, body.region_id):
        raise HTTPException(404, "지역을 찾을 수 없습니다.")
    s = Station(region_id=body.region_id, name=body.name, address=body.address, website=body.website, source="관리자 수동 등록")
    db.add(s)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "이미 등록된 경찰서입니다.")
    for name in dict.fromkeys(body.department_names):  # 중복 제거, 순서 유지
        db.add(Department(station_id=s.id, name=name))
    log_action(db, admin.id, "station_created", "station", s.id, {"name": s.name})
    db.commit()
    return {"id": s.id, "name": s.name}


@router.post("/officers", response_model=AdminOfficer, status_code=status.HTTP_201_CREATED)
def create_officer(body: OfficerCreate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    if not db.get(Station, body.station_id):
        raise HTTPException(404, "경찰서를 찾을 수 없습니다.")
    dept = _get_or_create_department(db, body.station_id, body.department_name) if body.department_name else None
    o = Officer(station_id=body.station_id, department_id=dept.id if dept else None, name=body.name, rank=body.rank, source=body.source)
    o.assignments = [OfficerAssignment(period=a.period, description=a.description) for a in body.assignments]
    db.add(o)
    db.flush()
    log_action(db, admin.id, "officer_created", "officer", o.id, {"source": body.source.value})
    db.commit()
    return _admin_officer(o)


@router.patch("/officers/{officer_id}", response_model=AdminOfficer)
def update_officer(officer_id: int, body: OfficerUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    o = db.get(Officer, officer_id)
    if not o:
        raise HTTPException(404, "수사관을 찾을 수 없습니다.")
    changes: dict[str, Any] = {}
    for field in ("name", "rank", "source", "is_published"):
        v = getattr(body, field)
        if v is not None:
            changes[field] = v.value if hasattr(v, "value") else v
            setattr(o, field, v)
    if body.department_name is not None:
        o.department_id = _get_or_create_department(db, o.station_id, body.department_name).id
        changes["department"] = body.department_name
    if body.assignments is not None:
        o.assignments = [OfficerAssignment(period=a.period, description=a.description) for a in body.assignments]
        changes["assignments"] = len(body.assignments)
    log_action(db, admin.id, "officer_updated", "officer", o.id, changes)
    db.commit()
    db.refresh(o)
    return _admin_officer(o)


# ---------- 감사 로그(읽기 전용) ----------
class AuditOut(BaseModel):
    id: int
    actor_id: int | None
    actor_email: str | None
    action: str
    target_type: str
    target_id: int | None
    detail: dict[str, Any] | None
    created_at: str | None


@router.get("/audit-logs", response_model=Page[AuditOut])
def audit_logs(
    action: str | None = None, page: int = Query(1, ge=1), size: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)
):
    q = select(AuditLog)
    cq = select(func.count(AuditLog.id))
    if action:
        q, cq = q.where(AuditLog.action == action), cq.where(AuditLog.action == action)
    rows = db.scalars(q.order_by(AuditLog.id.desc()).offset((page - 1) * size).limit(size)).all()
    actor_ids = {a.actor_id for a in rows if a.actor_id is not None}
    emails = dict(db.execute(select(User.id, User.email).where(User.id.in_(actor_ids))).all()) if actor_ids else {}
    return Page(
        items=[
            AuditOut(
                id=a.id, actor_id=a.actor_id, actor_email=emails.get(a.actor_id), action=a.action,
                target_type=a.target_type, target_id=a.target_id, detail=a.detail, created_at=iso(a.created_at),
            )
            for a in rows
        ],
        total=db.scalar(cq) or 0, page=page, size=size,
    )



# ---------- 사건 공론화 ----------
@router.get("/cases", response_model=Page[AdminCaseOut])
def admin_list_cases(
    status_: CaseStatus = Query(CaseStatus.held, alias="status"),
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db),
):
    """기본은 보류(held) 큐 — 개인정보·실명 노출 위험이 자동 탐지돼 공개 전 확인이 필요한 사건."""
    base = select(PublicCase).where(PublicCase.status == status_)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    order = PublicCase.created_at.asc() if status_ == CaseStatus.held else PublicCase.created_at.desc()
    rows = db.scalars(base.options(joinedload(PublicCase.station)).order_by(order, PublicCase.id).offset((page - 1) * size).limit(size)).all()
    nick = dict(db.execute(select(User.id, User.nickname).where(User.id.in_({c.author_id for c in rows}))).all()) if rows else {}
    return Page(items=[
        AdminCaseOut(
            id=c.id, author_nickname=nick.get(c.author_id), title=c.title, body=c.body, desired_action=c.desired_action,
            category_label=CASE_CATEGORY_LABELS[c.category], station_name=c.station.name if c.station else None,
            status=c.status.value, hold_reason=c.hold_reason, blind_reason=c.blind_reason, empathy_count=c.empathy_count,
            pending_reporters=blinding.pending_reporter_count(db, ReportTarget.public_case, c.id),
            created_at=iso(c.created_at),
        ) for c in rows
    ], total=total, page=page, size=size)


@router.post("/cases/{case_id}/approve", status_code=status.HTTP_204_NO_CONTENT)
def admin_approve_case(case_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    """보류된 사건을 확인 후 공개."""
    c = db.get(PublicCase, case_id)
    if not c or c.status != CaseStatus.held:
        raise HTTPException(409, "보류 상태인 사건만 승인할 수 있습니다.")
    c.status, c.hold_reason = CaseStatus.published, None
    log_action(db, admin.id, "case.approve", "public_case", c.id, {})
    db.commit()


@router.post("/cases/{case_id}/remove", status_code=status.HTTP_204_NO_CONTENT)
def admin_remove_case(case_id: int, body: RejectIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    c = db.get(PublicCase, case_id)
    if not c or c.status == CaseStatus.removed:
        raise HTTPException(404, "사건을 찾을 수 없습니다.")
    c.status, c.removed_reason = CaseStatus.removed, body.reason[:300]
    log_action(db, admin.id, "case.remove", "public_case", c.id, {"reason": body.reason})
    db.commit()
