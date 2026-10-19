"""개인정보 보관 기간 경과분 파기(services/retention.py) — 개인정보처리방침의 보관 기간 표와 같은 기준."""
from datetime import datetime, timedelta, timezone

from app.models import (
    AdInquiry, InquiryStatus, InquiryType, OfficerVerification, Review, ReviewStatus, TakedownRequest, User,
    VerificationStatus,
)
from app.services.retention import PURGED, run_purge
from conftest import make_user, review_payload

API = "/api/v1"
NOW = datetime.now(timezone.utc)


def _verification(db, user, station, status, reviewed_days_ago=None):
    v = OfficerVerification(
        user_id=user.id, station_id=station.id, name="홍길동", rank="경위", contact="010-0000-0000", status=status,
        reviewed_at=NOW - timedelta(days=reviewed_days_ago) if reviewed_days_ago is not None else None,
    )
    db.add(v)
    db.commit()
    return v.id


def test_officer_verifications_purged_after_one_year(db, world):
    u = make_user(db, "officer@example.com")
    old_rejected = _verification(db, u, world["station"], VerificationStatus.rejected, 400)
    recent_rejected = _verification(db, u, world["station"], VerificationStatus.rejected, 100)
    approved = _verification(db, u, world["station"], VerificationStatus.approved, 400)
    gone = make_user(db, "gone@example.com")
    gone.deleted_at = NOW - timedelta(days=400)
    db.commit()
    of_withdrawn = _verification(db, gone, world["station"], VerificationStatus.approved, 500)

    run_purge(db)
    db.expire_all()
    assert db.get(OfficerVerification, old_rejected) is None
    assert db.get(OfficerVerification, of_withdrawn) is None
    assert db.get(OfficerVerification, recent_rejected) is not None
    assert db.get(OfficerVerification, approved) is not None  # 인증 유지 중이면 보관


def test_ad_inquiries_purged_one_year_after_done(db):
    def inquiry(status, done_days_ago=None, created_days_ago=0):
        q = AdInquiry(
            inquiry_type=InquiryType.ad, company="회사", name="담당", contact="010-1111-2222", message="문의 내용입니다 열자",
            status=status, done_at=NOW - timedelta(days=done_days_ago) if done_days_ago is not None else None,
            created_at=NOW - timedelta(days=created_days_ago),
        )
        db.add(q)
        db.commit()
        return q.id

    old = inquiry(InquiryStatus.done, 400)
    recent = inquiry(InquiryStatus.done, 30)
    legacy_old = inquiry(InquiryStatus.done, None, 400)  # done_at 기록 전 처리분은 접수 시각 기준
    open_old = inquiry(InquiryStatus.new, None, 400)  # 아직 처리 안 한 문의는 보관
    run_purge(db)
    db.expire_all()
    assert db.get(AdInquiry, old) is None and db.get(AdInquiry, legacy_old) is None
    assert db.get(AdInquiry, recent) is not None and db.get(AdInquiry, open_old) is not None


def test_takedown_requester_info_purged_after_three_years(db, client, world):
    rid = client.post(f"{API}/reviews", json=review_payload(world["station"].id, case_number=None)).json()["id"]
    t = TakedownRequest(
        public_code="code-old", target_type="review", review_id=rid, request_type="delete", requester_name="홍길동",
        requester_contact="hong@example.com", relation="본인", reason="사실과 다른 내용입니다", status="kept",
        due_at=NOW, resolved_at=NOW - timedelta(days=365 * 3 + 10),
    )
    db.add(t)
    db.commit()
    run_purge(db)
    db.refresh(t)
    assert t.requester_name == PURGED and t.requester_contact == "" and t.reason == PURGED


def test_case_number_cleared_when_review_removed(db, client, world):
    rid = client.post(f"{API}/reviews", json=review_payload(world["station"].id)).json()["id"]
    r = db.get(Review, rid)
    assert r.case_number
    r.status = ReviewStatus.removed
    db.commit()
    run_purge(db)
    db.refresh(r)
    assert r.case_number is None and r.case_number_hash is None
    # 같은 사건번호로 다시 평가할 수 있다(삭제된 평가가 막지 않음).
    assert client.post(f"{API}/reviews", json=review_payload(world["station"].id)).status_code == 201


def test_withdraw_records_deleted_at(db, user_client):
    user_client.request("DELETE", f"{API}/auth/me", json={"password": "password123"})
    db.expire_all()
    u = db.query(User).filter(User.nickname == "탈퇴한 회원").one()
    assert u.deleted_at is not None
