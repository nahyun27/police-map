"""개인정보 보관 기간 경과분 파기. 개인정보처리방침(src/app/privacy/page.tsx)의 보관 기간 표와 맞춘다.
기간을 바꾸면 두 곳을 함께 고쳐야 한다.

- 수사관 인증 신청: 인증 해제(또는 반려) 후 1년, 회원 탈퇴 후 1년
- 삭제·정정 요청: 처리 완료 후 3년 (요청 기록 자체는 게시물 비공개 상태의 근거라 남기고, 요청인 정보만 지운다)
- 광고·제휴 문의: 처리 완료 후 1년
- 평가의 사건번호: 평가가 삭제되면 바로

회원 정보는 탈퇴 즉시 파기한다(services/account.py). 서버 접속 기록(nginx·journald)은 서버 설정으로 관리한다.
main.py 가 서버 시작 시와 이후 하루마다 run_purge() 를 부른다. 수동 실행: python -m scripts.purge_expired
"""
from datetime import timedelta

from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session

from app.models import (
    AdInquiry, InquiryStatus, OfficerVerification, Review, ReviewStatus, TakedownRequest, User, VerificationStatus,
)
from app.services.audit import log_action
from app.services.takedown import utcnow

VERIFICATION_RETENTION = timedelta(days=365)
TAKEDOWN_RETENTION = timedelta(days=365 * 3)
INQUIRY_RETENTION = timedelta(days=365)

PURGED = "(보관 기간 경과로 파기)"


def run_purge(db: Session) -> dict[str, int]:
    now = utcnow()
    counts: dict[str, int] = {}

    # 수사관 인증 신청: 반려·인증 해제(둘 다 rejected, reviewed_at 이 그 시각) 후 1년, 또는 신청자 탈퇴 후 1년.
    withdrawn = select(User.id).where(User.deleted_at.is_not(None), User.deleted_at < now - VERIFICATION_RETENTION)
    counts["officer_verifications"] = db.execute(
        delete(OfficerVerification).where(or_(
            (OfficerVerification.status == VerificationStatus.rejected)
            & (OfficerVerification.reviewed_at < now - VERIFICATION_RETENTION),
            OfficerVerification.user_id.in_(withdrawn),
        )).execution_options(synchronize_session=False)
    ).rowcount or 0

    # 삭제·정정 요청: 처리 완료 후 3년이 지나면 요청인 정보(성명·연락처·사유)만 지운다.
    counts["takedown_requests"] = db.execute(
        update(TakedownRequest).where(
            TakedownRequest.resolved_at.is_not(None), TakedownRequest.resolved_at < now - TAKEDOWN_RETENTION,
            TakedownRequest.requester_contact != "",
        ).values(requester_name=PURGED, requester_contact="", reason=PURGED)
        .execution_options(synchronize_session=False)
    ).rowcount or 0

    # 광고·제휴 문의: 처리 완료 후 1년. 완료 시각 기록(done_at) 이전에 처리된 건은 접수 시각으로 대신 판단한다.
    counts["ad_inquiries"] = db.execute(
        delete(AdInquiry).where(
            AdInquiry.status == InquiryStatus.done,
            or_(
                AdInquiry.done_at < now - INQUIRY_RETENTION,
                AdInquiry.done_at.is_(None) & (AdInquiry.created_at < now - INQUIRY_RETENTION),
            ),
        ).execution_options(synchronize_session=False)
    ).rowcount or 0

    # 사건번호: 삭제된 평가에서는 바로 지운다(중복 확인용 해시도 함께, 삭제된 평가가 같은 사건번호의 새 평가를 막지 않게).
    counts["review_case_numbers"] = db.execute(
        update(Review).where(
            Review.status == ReviewStatus.removed,
            or_(Review.case_number.is_not(None), Review.case_number_hash.is_not(None)),
        ).values(case_number=None, case_number_hash=None)
        .execution_options(synchronize_session=False)
    ).rowcount or 0

    if any(counts.values()):
        log_action(db, None, "retention.purge", "system", None, counts)
    db.commit()
    return counts
