"""사건 공론화 + 게시물 블라인드(신고 누적 자동 / 관리자 수동) — 2026-10 의뢰인 결정."""
from datetime import datetime, timedelta, timezone

from fastapi.testclient import TestClient

from app.main import app
from conftest import login, make_user, review_payload

API = "/api/v1"


def case_payload(**over):
    body = {
        "category": "delay", "title": "진행 상황 안내를 받지 못했습니다",
        "body": "사건 접수 후 석 달 동안 처리 상황을 여러 차례 문의했지만 충분한 설명을 받지 못했습니다.",
        "desired_action": "처리 경과에 대한 설명", "agreed": True,
    }
    body.update(over)
    return body


def reporters(db, n: int, prefix: str = "r", aged: bool = True):
    """aged=True 면 가입 이틀 지난 계정으로 만든다(자동 블라인드는 가입 24시간 지난 계정만 센다)."""
    clients = []
    for i in range(n):
        u = make_user(db, f"{prefix}{i}@example.com")
        if aged:
            u.created_at = datetime.now(timezone.utc) - timedelta(days=2)
            db.commit()
        clients.append(login(TestClient(app), f"{prefix}{i}@example.com"))
    return clients


# ---------- 사건 공론화 ----------
def test_case_requires_login_to_write_but_anyone_can_read(client, user_client, world):
    assert client.post(f"{API}/cases", json=case_payload()).status_code == 401
    r = user_client.post(f"{API}/cases", json=case_payload(station_id=world["station"].id))
    assert r.status_code == 201 and r.json()["status"] == "published"
    cid = r.json()["id"]

    lst = client.get(f"{API}/cases").json()
    assert lst["total"] == 1 and lst["items"][0]["station_name"] == "테스트경찰서"
    detail = client.get(f"{API}/cases/{cid}").json()
    assert detail["status"] == "published" and detail["is_mine"] is False and detail["hold_reason"] is None


def test_case_must_agree_to_guidelines(user_client):
    assert user_client.post(f"{API}/cases", json=case_payload(agreed=False)).status_code == 422


def test_case_with_personal_info_is_held_until_admin_approves(client, user_client, admin_client):
    r = user_client.post(f"{API}/cases", json=case_payload(body="김철수 경위가 010-1234-5678 로 연락하라고 했는데 석 달째 아무 답이 없습니다."))
    assert r.status_code == 201 and r.json()["status"] == "held"
    cid = r.json()["id"]

    assert client.get(f"{API}/cases").json()["total"] == 0
    assert client.get(f"{API}/cases/{cid}").status_code == 404
    mine = user_client.get(f"{API}/cases/{cid}").json()  # 작성자 본인은 볼 수 있다
    assert mine["status"] == "held" and "전화번호" in mine["hold_reason"] and "실명" in mine["hold_reason"]

    queue = admin_client.get(f"{API}/admin/cases?status=held").json()
    assert [x["id"] for x in queue["items"]] == [cid]
    assert admin_client.post(f"{API}/admin/cases/{cid}/approve").status_code == 204
    assert client.get(f"{API}/cases/{cid}").status_code == 200


def test_case_banned_words_rejected(user_client):
    r = user_client.post(f"{API}/cases", json=case_payload(body="담당자가 정말 무능하고 쓰레기 같은 태도로 일관해서 아무것도 진행되지 않았습니다."))
    assert r.status_code == 422


def test_empathy_once_per_member(db, client, user_client):
    cid = user_client.post(f"{API}/cases", json=case_payload()).json()["id"]
    assert user_client.post(f"{API}/cases/{cid}/empathy").json() == {"empathized": True, "empathy_count": 1}
    assert user_client.post(f"{API}/cases/{cid}/empathy").json()["empathy_count"] == 1  # 두 번 눌러도 1
    other = reporters(db, 1, "emp")[0]
    assert other.post(f"{API}/cases/{cid}/empathy").json()["empathy_count"] == 2
    assert user_client.delete(f"{API}/cases/{cid}/empathy").json() == {"empathized": False, "empathy_count": 1}
    assert other.get(f"{API}/cases/{cid}").json()["my_empathy"] is True


def test_progress_updates_author_only_and_pii_rejected(db, user_client):
    cid = user_client.post(f"{API}/cases", json=case_payload()).json()["id"]
    r = user_client.post(f"{API}/cases/{cid}/updates", json={"body": "국민신문고에 민원을 접수했습니다."})
    assert r.status_code == 201
    assert user_client.post(f"{API}/cases/{cid}/updates", json={"body": "제 번호는 010-9999-8888 입니다"}).status_code == 422
    other = reporters(db, 1, "upd")[0]
    assert other.post(f"{API}/cases/{cid}/updates", json={"body": "남의 사건 업데이트 시도"}).status_code == 403
    assert [u["body"] for u in user_client.get(f"{API}/cases/{cid}").json()["updates"]] == ["국민신문고에 민원을 접수했습니다."]


def test_my_cases_shows_status(user_client):
    user_client.post(f"{API}/cases", json=case_payload())
    user_client.post(f"{API}/cases", json=case_payload(body="연락처 abc@test.com 으로 회신을 요청했는데 답변이 없습니다. 기다리고 있습니다."))
    statuses = sorted(x["status"] for x in user_client.get(f"{API}/cases/mine").json())
    assert statuses == ["held", "published"]


def test_takedown_request_blinds_case(client, user_client):
    cid = user_client.post(f"{API}/cases", json=case_payload()).json()["id"]
    r = client.post(f"{API}/takedown-requests", json={
        "target_type": "public_case", "target_id": cid, "request_type": "delete", "requester_name": "홍길동",
        "requester_contact": "hong@example.com", "relation": "본인", "reason": "사실과 다른 내용이 게시되어 있습니다.",
    })
    assert r.status_code == 201
    assert client.get(f"{API}/cases/{cid}").status_code == 404
    mine = [x for x in user_client.get(f"{API}/cases/mine").json() if x["id"] == cid][0]
    assert mine["status"] == "blinded" and "삭제·정정 요청" in mine["blind_reason"]


# ---------- 신고 누적 자동 블라인드 ----------
def _report_n(clients, target_type, target_id):
    for c in clients:
        assert c.post(f"{API}/reports", json={"target_type": target_type, "target_id": target_id, "reason": "부적절한 내용입니다"}).status_code == 201


def test_post_auto_blinded_at_five_reports_and_visible_in_authors_mypage(db, client, user_client):
    pid = user_client.post(f"{API}/posts", json={"title": "테스트 게시글입니다", "body": "본문 내용"}).json()["id"]
    rs = reporters(db, 5)
    _report_n(rs[:4], "post", pid)
    assert client.get(f"{API}/posts/{pid}").status_code == 200  # 4건까지는 그대로
    _report_n(rs[4:], "post", pid)

    assert client.get(f"{API}/posts/{pid}").status_code == 404
    assert all(x["id"] != pid for x in client.get(f"{API}/posts").json()["items"])
    assert all(x["id"] != pid for x in client.get(f"{API}/board/feed").json()["items"])
    own = user_client.get(f"{API}/posts/{pid}").json()  # 작성자는 사유와 함께 볼 수 있다
    assert own["is_blinded"] is True and "신고" in own["blind_reason"]
    mine = user_client.get(f"{API}/posts/mine").json()["items"]
    assert mine[0]["id"] == pid and mine[0]["is_blinded"] is True


def test_same_reporter_twice_does_not_count_double(db, client, user_client):
    pid = user_client.post(f"{API}/posts", json={"title": "테스트 게시글입니다", "body": "본문 내용"}).json()["id"]
    rs = reporters(db, 4)
    _report_n(rs, "post", pid)
    assert rs[0].post(f"{API}/reports", json={"target_type": "post", "target_id": pid, "reason": "또 신고합니다"}).status_code == 409
    assert client.get(f"{API}/posts/{pid}").status_code == 200


def test_review_auto_blinded_and_shown_in_my_reviews(db, client, user_client, world):
    rid = user_client.post(f"{API}/reviews", json=review_payload(world["station"].id)).json()["id"]
    _report_n(reporters(db, 5), "review", rid)
    assert client.get(f"{API}/reviews/{rid}").status_code == 404
    mine = [x for x in user_client.get(f"{API}/reviews/mine").json()["items"] if x["id"] == rid][0]
    assert mine["status"] == "blinded" and "신고" in mine["blind_reason"]


def test_case_auto_blinded(db, client, user_client):
    cid = user_client.post(f"{API}/cases", json=case_payload()).json()["id"]
    _report_n(reporters(db, 5), "public_case", cid)
    assert client.get(f"{API}/cases/{cid}").status_code == 404
    assert client.get(f"{API}/cases").json()["total"] == 0


def test_dismissing_reports_restores_auto_blind(db, client, user_client, admin_client):
    pid = user_client.post(f"{API}/posts", json={"title": "테스트 게시글입니다", "body": "본문 내용"}).json()["id"]
    _report_n(reporters(db, 5), "post", pid)
    queue = admin_client.get(f"{API}/admin/reports").json()["items"]
    assert queue[0]["target_blinded"] is True and queue[0]["pending_reporters"] == 5
    assert queue[0]["target_blind_auto"] is True
    r = admin_client.post(f"{API}/admin/reports/{queue[0]['id']}/resolve", json={"action": "dismiss", "note": "문제 없는 글로 판단"})
    assert r.status_code == 200
    assert admin_client.get(f"{API}/admin/reports").json()["total"] == 0  # 같은 대상 신고는 일괄 처리
    assert client.get(f"{API}/posts/{pid}").status_code == 200


# ---------- 관리자 수동 블라인드 ----------
def test_admin_manual_blind_and_unblind(client, user_client, admin_client, world):
    pid = user_client.post(f"{API}/posts", json={"title": "테스트 게시글입니다", "body": "본문 내용"}).json()["id"]
    assert user_client.post(f"{API}/admin/blind", json={"target_type": "post", "target_id": pid}).status_code == 403
    r = admin_client.post(f"{API}/admin/blind", json={"target_type": "post", "target_id": pid, "reason": "개인정보 노출"})
    assert r.status_code == 204
    assert client.get(f"{API}/posts/{pid}").status_code == 404
    assert user_client.get(f"{API}/posts/{pid}").json()["blind_reason"] == "개인정보 노출"
    blinded = admin_client.get(f"{API}/admin/blinded").json()
    assert any(x["target_type"] == "post" and x["target_id"] == pid and x["is_auto"] is False for x in blinded)

    assert admin_client.post(f"{API}/admin/unblind", json={"target_type": "post", "target_id": pid}).status_code == 204
    assert client.get(f"{API}/posts/{pid}").status_code == 200

    rid = world["reviews"][0].id
    assert admin_client.post(f"{API}/admin/blind", json={"target_type": "review", "target_id": rid}).status_code == 204
    assert client.get(f"{API}/reviews/{rid}").status_code == 404
    assert admin_client.post(f"{API}/admin/blind", json={"target_type": "post_comment", "target_id": 1}).status_code == 422


def test_admin_dismiss_keeps_manual_blind(db, client, user_client, admin_client):
    pid = user_client.post(f"{API}/posts", json={"title": "테스트 게시글입니다", "body": "본문 내용"}).json()["id"]
    _report_n(reporters(db, 1), "post", pid)
    admin_client.post(f"{API}/admin/blind", json={"target_type": "post", "target_id": pid, "reason": "심각한 명예훼손 소지"})
    rep = admin_client.get(f"{API}/admin/reports").json()["items"][0]
    admin_client.post(f"{API}/admin/reports/{rep['id']}/resolve", json={"action": "dismiss", "note": "신고는 종결"})
    assert client.get(f"{API}/posts/{pid}").status_code == 404  # 수동 블라인드는 그대로


def test_account_deletion_removes_case_empathy(db, user_client):
    cid = user_client.post(f"{API}/cases", json=case_payload()).json()["id"]
    other = reporters(db, 1, "bye")[0]
    other.post(f"{API}/cases/{cid}/empathy")
    assert other.request("DELETE", f"{API}/auth/me", json={"password": "password123"}).status_code in (200, 204)
    assert user_client.get(f"{API}/cases/{cid}").json()["empathy_count"] == 0


# ---------- 회귀 테스트(버그 점검 2026-10-15) ----------
def test_dismiss_does_not_restore_while_takedown_pending(db, client, user_client, admin_client, world):
    """신고 누적으로 이미 블라인드된 평가에 삭제·정정 요청이 들어온 뒤 신고를 기각해도 다시 공개되면 안 된다."""
    rid = user_client.post(f"{API}/reviews", json=review_payload(world["station"].id)).json()["id"]
    _report_n(reporters(db, 5), "review", rid)
    assert client.post(f"{API}/takedown-requests", json={
        "target_type": "review", "target_id": rid, "request_type": "delete", "requester_name": "홍길동",
        "requester_contact": "h@example.com", "relation": "본인", "reason": "사실과 다른 내용이 게시되어 있습니다.",
    }).status_code == 201
    rep = admin_client.get(f"{API}/admin/reports").json()["items"][0]
    admin_client.post(f"{API}/admin/reports/{rep['id']}/resolve", json={"action": "dismiss", "note": "신고 사유 부족"})
    assert client.get(f"{API}/reviews/{rid}").status_code == 404  # 요청 처리 전까지 비공개 유지
    assert admin_client.post(f"{API}/admin/unblind", json={"target_type": "review", "target_id": rid}).status_code == 409


def test_empathy_toggle_counts_stay_consistent(db, user_client):
    cid = user_client.post(f"{API}/cases", json=case_payload()).json()["id"]
    others = reporters(db, 3, "emc")
    for c in others:
        c.post(f"{API}/cases/{cid}/empathy")
    others[0].delete(f"{API}/cases/{cid}/empathy")
    others[0].delete(f"{API}/cases/{cid}/empathy")  # 두 번 취소해도 한 번만 깎인다
    assert user_client.get(f"{API}/cases/{cid}").json()["empathy_count"] == 2


def test_anonymous_empathy_once_per_ip(db, client, user_client):
    """로그인 없이도 공감할 수 있다(2026-10). 비회원은 IP 해시당 사건별 1회, 취소 가능."""
    cid = user_client.post(f"{API}/cases", json=case_payload()).json()["id"]
    assert client.post(f"{API}/cases/{cid}/empathy").json() == {"empathized": True, "empathy_count": 1}
    assert client.post(f"{API}/cases/{cid}/empathy").json()["empathy_count"] == 1  # 같은 IP 는 한 번만
    assert client.get(f"{API}/cases/{cid}").json()["my_empathy"] is True
    assert user_client.post(f"{API}/cases/{cid}/empathy").json()["empathy_count"] == 2  # 회원은 따로 센다
    assert client.delete(f"{API}/cases/{cid}/empathy").json() == {"empathized": False, "empathy_count": 1}
    assert client.get(f"{API}/cases").json()["items"][0]["my_empathy"] is False
