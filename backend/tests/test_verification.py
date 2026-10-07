from conftest import login, make_user

API = "/api/v1"


def verify_payload(station_id: int, **over):
    body = {
        "station_id": station_id, "name": "김경위", "rank": "경위", "department": "수사과",
        "contact": "kim@police.go.kr", "proof_note": "대표번호로 확인 요망",
    }
    body.update(over)
    return body


# ---------- 신청 ----------
def test_apply_requires_login(client, world):
    assert client.post(f"{API}/officer-verifications", json=verify_payload(world["station"].id)).status_code == 401


def test_apply_and_check_mine(user_client, world):
    r = user_client.post(f"{API}/officer-verifications", json=verify_payload(world["station"].id))
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "pending" and body["station_name"] == world["station"].name

    mine = user_client.get(f"{API}/officer-verifications/mine").json()
    assert len(mine) == 1 and mine[0]["name"] == "김경위"


def test_cannot_apply_twice_while_pending(user_client, world):
    user_client.post(f"{API}/officer-verifications", json=verify_payload(world["station"].id))
    r = user_client.post(f"{API}/officer-verifications", json=verify_payload(world["station"].id))
    assert r.status_code == 409


def test_unknown_station_is_404(user_client):
    assert user_client.post(f"{API}/officer-verifications", json=verify_payload(9999)).status_code == 404


# ---------- 관리자 심사 ----------
def test_admin_approve_reflects_on_me(user_client, admin_client, world):
    vid = user_client.post(f"{API}/officer-verifications", json=verify_payload(world["station"].id)).json()["id"]
    r = admin_client.post(f"{API}/admin/officer-verifications/{vid}/approve")
    assert r.status_code == 200 and r.json()["status"] == "approved"

    me = user_client.get(f"{API}/auth/me").json()
    assert me["officer_station_id"] == world["station"].id and me["officer_rank"] == "경위"


def test_cannot_apply_once_approved(user_client, admin_client, world):
    vid = user_client.post(f"{API}/officer-verifications", json=verify_payload(world["station"].id)).json()["id"]
    admin_client.post(f"{API}/admin/officer-verifications/{vid}/approve")
    r = user_client.post(f"{API}/officer-verifications", json=verify_payload(world["station"].id))
    assert r.status_code == 409


def test_admin_reject_requires_reason(user_client, admin_client, world):
    vid = user_client.post(f"{API}/officer-verifications", json=verify_payload(world["station"].id)).json()["id"]
    assert admin_client.post(f"{API}/admin/officer-verifications/{vid}/reject", json={"reason": "짧"}).status_code == 422
    r = admin_client.post(f"{API}/admin/officer-verifications/{vid}/reject", json={"reason": "소속 확인이 되지 않습니다"})
    assert r.status_code == 200 and r.json()["status"] == "rejected"
    me = user_client.get(f"{API}/auth/me").json()
    assert me["officer_station_id"] is None  # 반려됐으니 인증 안 됨


def test_admin_revoke_clears_officer_status(user_client, admin_client, world):
    vid = user_client.post(f"{API}/officer-verifications", json=verify_payload(world["station"].id)).json()["id"]
    admin_client.post(f"{API}/admin/officer-verifications/{vid}/approve")
    r = admin_client.post(f"{API}/admin/officer-verifications/{vid}/revoke", json={"reason": "전출로 인한 인증 해제"})
    assert r.status_code == 200
    me = user_client.get(f"{API}/auth/me").json()
    assert me["officer_station_id"] is None


def test_admin_endpoints_require_admin(client, user_client, world):
    assert client.get(f"{API}/admin/officer-verifications").status_code == 401
    assert user_client.get(f"{API}/admin/officer-verifications").status_code == 403


# ---------- 해명(리뷰 reply) ----------
def _verified_officer_client(db, client, world, email="officer@example.com", station=None):
    """지정한 이메일로 회원가입 + 경찰관 인증 신청 + (공용 관리자 계정으로) 즉시 승인까지 마친
    로그인 상태의 클라이언트를 돌려준다. 한 테스트에서 여러 번 불러도 관리자 계정은 한 번만 만든다."""
    from app.models import User, UserRole

    make_user(db, email)
    c = login(client, email)
    vid = c.post(f"{API}/officer-verifications", json=verify_payload((station or world["station"]).id)).json()["id"]
    c.post(f"{API}/auth/logout")

    if not db.query(User).filter(User.email == "verify_admin@example.com").first():
        make_user(db, "verify_admin@example.com", UserRole.admin)
    admin_c = login(client, "verify_admin@example.com")
    admin_c.post(f"{API}/admin/officer-verifications/{vid}/approve")
    admin_c.post(f"{API}/auth/logout")
    return login(client, email)


def test_reply_requires_officer_verification(user_client, world):
    rid = world["reviews"][0].id
    r = user_client.post(f"{API}/reviews/{rid}/reply", json={"body": "해당 민원 관련 설명드립니다."})
    assert r.status_code == 403


def test_reply_rejects_wrong_station(db, client, world):
    officer = _verified_officer_client(db, client, world, station=world["station2"])  # station2 로 인증
    rid = world["reviews"][0].id  # station(1) 소속 리뷰
    assert officer.post(f"{API}/reviews/{rid}/reply", json={"body": "설명드립니다."}).status_code == 403


def test_reply_create_and_shows_on_station_detail(db, client, world):
    officer = _verified_officer_client(db, client, world)
    rid = world["reviews"][0].id
    r = officer.post(f"{API}/reviews/{rid}/reply", json={"body": "해당 사안은 절차대로 처리되었습니다.", "show_name": False})
    assert r.status_code == 201
    assert "경위" in r.json()["author_label"] and r.json()["show_name"] is False

    pub = client.get(f"{API}/stations/{world['station'].id}").json()
    hit = next(x for x in pub["reviews"]["items"] if x["id"] == rid)
    assert hit["reply"]["body"] == "해당 사안은 절차대로 처리되었습니다."
    assert "김경위" not in hit["reply"]["author_label"]  # show_name False 라 실명 비노출


def test_reply_show_name_true_exposes_name(db, client, world):
    officer = _verified_officer_client(db, client, world)
    rid = world["reviews"][0].id
    officer.post(f"{API}/reviews/{rid}/reply", json={"body": "설명드립니다.", "show_name": True})
    pub = client.get(f"{API}/stations/{world['station'].id}").json()
    hit = next(x for x in pub["reviews"]["items"] if x["id"] == rid)
    assert hit["reply"]["author_label"] == "김경위"


def test_duplicate_reply_is_409(db, client, world):
    officer = _verified_officer_client(db, client, world)
    rid = world["reviews"][0].id
    officer.post(f"{API}/reviews/{rid}/reply", json={"body": "첫 해명"})
    r = officer.post(f"{API}/reviews/{rid}/reply", json={"body": "두 번째 해명"})
    assert r.status_code == 409


def test_reply_banned_word_rejected(db, client, world):
    officer = _verified_officer_client(db, client, world)
    rid = world["reviews"][0].id
    assert officer.post(f"{API}/reviews/{rid}/reply", json={"body": "민원인이 무능하다"}).status_code == 422


def test_reply_edit_by_author_only(db, client, world):
    officer = _verified_officer_client(db, client, world)
    rid = world["reviews"][0].id
    officer.post(f"{API}/reviews/{rid}/reply", json={"body": "원문"})
    officer.post(f"{API}/auth/logout")

    make_user(db, "other@example.com")
    other = login(client, "other@example.com")
    assert other.patch(f"{API}/reviews/{rid}/reply", json={"body": "수정 시도"}).status_code == 403
    other.post(f"{API}/auth/logout")

    officer = login(client, "officer@example.com")
    r = officer.patch(f"{API}/reviews/{rid}/reply", json={"body": "수정된 해명", "show_name": True})
    assert r.status_code == 200 and r.json()["body"] == "수정된 해명"


def test_reply_delete_then_another_officer_can_post(db, client, world):
    officer = _verified_officer_client(db, client, world)
    rid = world["reviews"][0].id
    officer.post(f"{API}/reviews/{rid}/reply", json={"body": "첫 해명"})
    officer.post(f"{API}/auth/logout")

    make_user(db, "other@example.com")
    other = login(client, "other@example.com")
    assert other.delete(f"{API}/reviews/{rid}/reply").status_code == 403
    other.post(f"{API}/auth/logout")

    officer = login(client, "officer@example.com")
    assert officer.delete(f"{API}/reviews/{rid}/reply").status_code == 204
    officer.post(f"{API}/auth/logout")

    officer2 = _verified_officer_client(db, client, world, email="officer2@example.com")
    assert officer2.post(f"{API}/reviews/{rid}/reply", json={"body": "새 해명"}).status_code == 201


def test_update_reply_requires_still_verified(db, client, world):
    """작성 시점엔 인증돼 있었더라도, 그 사이 인증이 풀렸다면(전출 등) 수정은 다시 막혀야 한다."""
    from app.models import User

    officer = _verified_officer_client(db, client, world)
    rid = world["reviews"][0].id
    officer.post(f"{API}/reviews/{rid}/reply", json={"body": "원문"})

    u = db.query(User).filter(User.email == "officer@example.com").first()
    u.officer_station_id = None  # revoke 엔드포인트를 거치지 않고 인증 해제 상태만 흉내
    db.commit()

    r = officer.patch(f"{API}/reviews/{rid}/reply", json={"body": "수정 시도"})
    assert r.status_code == 403


def test_revoke_deletes_existing_reply(db, client, world):
    """관리자가 인증을 취소하면, 그 경찰서 소속으로 이미 올린 해명도 함께 지워져야 한다
    (취소된 뒤에도 "검증된 경찰관의 공식 해명"으로 계속 노출·수정되면 안 되므로)."""
    from app.models import OfficerVerification, ReviewReply, User

    officer = _verified_officer_client(db, client, world)
    rid = world["reviews"][0].id
    officer.post(f"{API}/reviews/{rid}/reply", json={"body": "원문"})
    officer.post(f"{API}/auth/logout")

    u = db.query(User).filter(User.email == "officer@example.com").first()
    vid = db.query(OfficerVerification).filter(OfficerVerification.user_id == u.id).first().id

    admin_c = login(client, "verify_admin@example.com")
    r = admin_c.post(f"{API}/admin/officer-verifications/{vid}/revoke", json={"reason": "전출로 인한 인증 해제"})
    assert r.status_code == 200

    db.expire_all()
    assert db.query(ReviewReply).filter(ReviewReply.review_id == rid).first() is None

    pub = client.get(f"{API}/stations/{world['station'].id}").json()
    hit = next(x for x in pub["reviews"]["items"] if x["id"] == rid)
    assert hit["reply"] is None
