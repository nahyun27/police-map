"""관리자 회원 관리: 목록·검색·이용 정지/해제·작성 글 열람."""
from fastapi.testclient import TestClient

from app.main import app
from app.models import AuditLog, User
from conftest import login, review_payload

API = "/api/v1"


def _uid(db, email):
    return db.query(User).filter_by(email=email).one().id


def test_only_admin_can_list_users(client, user_client, admin_client):
    assert client.get(f"{API}/admin/users").status_code == 401
    assert user_client.get(f"{API}/admin/users").status_code == 403
    body = admin_client.get(f"{API}/admin/users").json()
    assert body["total"] == 2 and {u["email"] for u in body["items"]} == {"user@example.com", "admin@example.com"}


def test_search_and_counts(db, user_client, admin_client, world):
    user_client.post(f"{API}/reviews", json=review_payload(world["station"].id))
    pid = user_client.post(f"{API}/posts", json={"title": "회원 관리 테스트", "body": "본문"}).json()["id"]
    admin_client.post(f"{API}/reports", json={"target_type": "post", "target_id": pid, "reason": "부적절한 내용입니다"})
    items = admin_client.get(f"{API}/admin/users", params={"q": "user@"}).json()["items"]
    assert len(items) == 1
    u = items[0]
    assert (u["review_count"], u["post_count"], u["reports_received"], u["status"]) == (1, 1, 1, "active")


def test_suspend_logs_out_blocks_login_and_unsuspend(db, user_client, admin_client):
    uid = _uid(db, "user@example.com")
    assert admin_client.post(f"{API}/admin/users/{uid}/suspend", json={"reason": "욕설 반복"}).json()["status"] == "suspended"
    assert user_client.get(f"{API}/auth/me").status_code == 401  # 기존 세션 즉시 끊김
    r = TestClient(app).post(f"{API}/auth/login", json={"email": "user@example.com", "password": "password123"})
    assert r.status_code == 403 and "정지" in r.json()["detail"]
    # 비밀번호가 틀리면 정지 여부를 드러내지 않는다.
    assert TestClient(app).post(f"{API}/auth/login", json={"email": "user@example.com", "password": "wrong-pass"}).status_code == 401
    assert admin_client.get(f"{API}/admin/users", params={"status": "suspended"}).json()["total"] == 1
    assert admin_client.post(f"{API}/admin/users/{uid}/unsuspend").json()["status"] == "active"
    assert login(TestClient(app), "user@example.com").get(f"{API}/auth/me").status_code == 200
    actions = {a.action for a in db.query(AuditLog).all()}
    assert {"user.suspend", "user.unsuspend"} <= actions


def test_cannot_suspend_admin(db, admin_client):
    uid = _uid(db, "admin@example.com")
    assert admin_client.post(f"{API}/admin/users/{uid}/suspend", json={"reason": "테스트"}).status_code == 422


def test_user_content_lists_items_and_is_logged(db, user_client, admin_client, world):
    user_client.post(f"{API}/posts", json={"title": "열람 테스트 글", "body": "본문"})
    uid = _uid(db, "user@example.com")
    items = admin_client.get(f"{API}/admin/users/{uid}/content").json()
    assert any(i["kind"] == "post" and i["text"] == "열람 테스트 글" for i in items)
    assert db.query(AuditLog).filter_by(action="user.view_content", target_id=uid).count() == 1
