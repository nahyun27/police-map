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


# ---------- 2026-10 출시 전 점검 2차 ----------
def test_officer_rank_must_be_from_list(db, client, world):
    """계급 칸에 실명을 적어("김철수경위") 이름 가림을 우회할 수 없다."""
    payload = review_payload(world["station"].id, officer_name="김철수", officer_rank="김철수경위")
    assert client.post(f"{API}/reviews", json=payload).status_code == 422
    ok = review_payload(world["station"].id, officer_name="김철수", officer_rank="경위", case_number=None)
    assert client.post(f"{API}/reviews", json=ok).status_code == 201


def test_officer_names_masked_in_comments_and_station_reviews(db, client, world):
    sid = world["station"].id
    rid = client.post(f"{API}/reviews", json=review_payload(sid, officer_name="최지훈", case_number=None)).json()["id"]
    c = client.post(f"{API}/reviews/{rid}/comments", json={"body": "최.지.훈 수사관 맞습니다"}).json()
    assert "최지훈" not in c["body"] and "최*훈" in c["body"]
    # 경찰서 전체 평가 본문에 이미 등록된 수사관 실명을 적어도 가려진다(폭 없는 공백 우회 포함).
    rid2 = client.post(f"{API}/reviews", json=review_payload(sid, body="담당은 최\u200b지훈 이었습니다", case_number=None)).json()["id"]
    assert "최*훈" in client.get(f"{API}/reviews/{rid2}").json()["body"]


def test_withdraw_reverts_post_score(db, user_client):
    pid = user_client.post(f"{API}/posts", json={"title": "점수 테스트 글", "body": "본문"}).json()["id"]
    voter = TestClient(app)
    make_user(db, "voter@example.com")
    login(voter, "voter@example.com")
    voter.post(f"{API}/posts/{pid}/vote", json={"value": 1})
    voter.request("DELETE", f"{API}/auth/me", json={"password": "password123"})
    from app.models import Post
    db.expire_all()
    assert db.get(Post, pid).score == 0


def test_new_accounts_cannot_auto_blind(db, user_client):
    pid = user_client.post(f"{API}/posts", json={"title": "블라인드 테스트", "body": "본문"}).json()["id"]
    for i in range(5):
        c = TestClient(app)
        make_user(db, f"fresh{i}@example.com")
        login(c, f"fresh{i}@example.com")
        assert c.post(f"{API}/reports", json={"target_type": "post", "target_id": pid, "reason": "부적절한 내용입니다"}).status_code == 201
    assert user_client.get(f"{API}/posts/{pid}").status_code == 200


def test_huge_ids_are_not_server_errors(client):
    assert client.get(f"{API}/reviews/99999999999999999999").status_code in (404, 422)


def test_my_review_states(db, user_client, client, world):
    sid = world["station"].id
    rid = user_client.post(f"{API}/reviews", json=review_payload(sid, case_number=None)).json()["id"]
    user_client.post(f"{API}/reviews/{rid}/vote", json={"value": 1})
    user_client.post(f"{API}/reviews/{rid}/scrap")
    items = user_client.get(f"{API}/reviews/my-state", params={"ids": f"{rid},999"}).json()["items"]
    assert items == [{"id": rid, "my_vote": 1, "is_scrapped": True, "reply_is_mine": False}]
    anon = client.get(f"{API}/reviews/my-state", params={"ids": str(rid)}).json()["items"]
    assert anon[0]["is_scrapped"] is False
    assert client.get(f"{API}/reviews/my-state", params={"ids": "a,b"}).status_code == 422
