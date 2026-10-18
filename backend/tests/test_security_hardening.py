"""출시 전 보안 점검(2026-10-18) 회귀 테스트."""
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.main import app
from conftest import login, make_user, review_payload

API = "/api/v1"


def test_logout_revokes_copied_tokens(db, user_client):
    stolen = dict(user_client.cookies)  # 로그아웃 전에 복사해 둔 쿠키(탈취 시나리오)
    assert user_client.post(f"{API}/auth/logout").status_code == 204
    thief = TestClient(app)
    for k, v in stolen.items():
        thief.cookies.set(k, v)
    assert thief.get(f"{API}/auth/me").status_code == 401
    assert thief.post(f"{API}/auth/refresh").status_code == 401


def test_login_again_after_logout_works(db, user_client):
    user_client.post(f"{API}/auth/logout")
    c = login(TestClient(app), "user@example.com")
    assert c.get(f"{API}/auth/me").status_code == 200


@pytest.mark.parametrize("env", ["production", "prod", "Production", "staging", ""])
def test_unsafe_defaults_refused_unless_explicitly_dev(env):
    with pytest.raises(RuntimeError):
        Settings(ENVIRONMENT=env, COOKIE_SECURE=False).assert_safe_for_production()


def test_dev_env_allows_defaults():
    Settings(ENVIRONMENT="development").assert_safe_for_production()


def test_scrap_does_not_eat_vote_quota(db, user_client, world):
    rid = user_client.post(f"{API}/reviews", json=review_payload(world["station"].id)).json()["id"]
    for _ in range(40):
        user_client.post(f"{API}/reviews/{rid}/scrap")
        user_client.delete(f"{API}/reviews/{rid}/scrap")
    assert user_client.post(f"{API}/reviews/{rid}/vote", json={"value": 1}).status_code == 200


def test_cannot_report_hidden_review(db, user_client, admin_client, world):
    rid = user_client.post(f"{API}/reviews", json=review_payload(world["station"].id)).json()["id"]
    admin_client.post(f"{API}/admin/blind", json={"target_type": "review", "target_id": rid})
    make_user(db, "rep@example.com")
    rep = login(TestClient(app), "rep@example.com")
    r = rep.post(f"{API}/reports", json={"target_type": "review", "target_id": rid, "reason": "부적절한 내용입니다"})
    missing = rep.post(f"{API}/reports", json={"target_type": "review", "target_id": 999999, "reason": "부적절한 내용입니다"})
    assert r.status_code == missing.status_code == 404  # 숨긴 글과 없는 글을 구분할 수 없다


def test_cannot_vote_comment_under_hidden_review(db, user_client, admin_client, world):
    rid = user_client.post(f"{API}/reviews", json=review_payload(world["station"].id)).json()["id"]
    cid = user_client.post(f"{API}/reviews/{rid}/comments", json={"body": "댓글입니다"}).json()["id"]
    admin_client.post(f"{API}/admin/blind", json={"target_type": "review", "target_id": rid})
    assert user_client.post(f"{API}/reviews/comments/{cid}/vote", json={"value": 1}).status_code == 404


def test_expired_access_cookie_is_renewed_from_refresh(db, user_client, world):
    """access 쿠키가 만료돼 사라진 뒤에도(30분) 로그인이 이어지고, 글이 익명이 아닌 본인 계정으로 저장된다."""
    user_client.cookies.delete("pm_access")
    me = user_client.get(f"{API}/auth/me")
    assert me.status_code == 200 and "pm_access" in me.cookies  # 새 access 쿠키 발급
    user_client.cookies.delete("pm_access")
    rid = user_client.post(f"{API}/reviews", json=review_payload(world["station"].id)).json()["id"]
    assert any(x["id"] == rid for x in user_client.get(f"{API}/reviews/mine").json()["items"])


def test_refresh_fallback_respects_logout(db, user_client):
    stolen_refresh = user_client.cookies.get("pm_refresh")
    user_client.post(f"{API}/auth/logout")
    thief = TestClient(app)
    thief.cookies.set("pm_refresh", stolen_refresh)
    assert thief.get(f"{API}/auth/me").status_code == 401
