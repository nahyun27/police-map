from conftest import make_user, review_payload

API = "/api/v1/auth"


def test_register_login_me_logout(client):
    r = client.post(f"{API}/register", json={"email": "New@Example.com", "password": "password123", "nickname": "닉네임"})
    assert r.status_code == 201 and r.json()["email"] == "new@example.com" and r.json()["role"] == "user"
    assert "password" not in r.text
    assert client.get(f"{API}/me").json()["nickname"] == "닉네임"  # 가입 직후 로그인 상태
    assert client.post(f"{API}/logout").status_code == 204
    assert client.get(f"{API}/me").status_code == 401
    assert client.post(f"{API}/login", json={"email": "NEW@example.com", "password": "password123"}).status_code == 200


def test_cookies_are_httponly(client):
    r = client.post(f"{API}/register", json={"email": "a@example.com", "password": "password123", "nickname": "닉네임"})
    cookies = r.headers.get_list("set-cookie")
    assert len(cookies) == 2 and all("httponly" in c.lower() and "samesite=lax" in c.lower() for c in cookies)


def test_duplicate_email_and_bad_credentials(client, db):
    make_user(db, "dup@example.com")
    assert client.post(f"{API}/register", json={"email": "dup@example.com", "password": "password123", "nickname": "닉네임"}).status_code == 409
    assert client.post(f"{API}/login", json={"email": "dup@example.com", "password": "wrong-password"}).status_code == 401
    # 없는 계정과 틀린 비밀번호는 같은 응답(계정 존재 여부를 알려주지 않는다)
    a = client.post(f"{API}/login", json={"email": "dup@example.com", "password": "wrong-password"})
    b = client.post(f"{API}/login", json={"email": "nobody@example.com", "password": "wrong-password"})
    assert a.status_code == b.status_code == 401 and a.json() == b.json()


def test_password_validation(client):
    base = {"email": "p@example.com", "nickname": "닉네임"}
    assert client.post(f"{API}/register", json={**base, "password": "short"}).status_code == 422
    # 한글은 글자당 3바이트 — 25자면 75바이트라 bcrypt 한도(72)를 넘는다
    assert client.post(f"{API}/register", json={**base, "password": "가" * 25}).status_code == 422
    assert client.post(f"{API}/register", json={**base, "email": "not-an-email", "password": "password123"}).status_code == 422


def test_refresh_and_inactive_user(client, db):
    u = make_user(db, "r@example.com")
    client.post(f"{API}/login", json={"email": "r@example.com", "password": "password123"})
    assert client.post(f"{API}/refresh").status_code == 200
    u.is_active = False
    db.commit()
    assert client.get(f"{API}/me").status_code == 401  # 비활성화 즉시 차단
    assert client.post(f"{API}/refresh").status_code == 401


def test_access_token_cannot_be_used_as_refresh(client, db):
    from app.core.security import create_access_token
    u = make_user(db, "t@example.com")
    client.cookies.set("pm_refresh", create_access_token(u.id))
    assert client.post(f"{API}/refresh").status_code == 401


def test_login_rate_limit(client):
    codes = [client.post(f"{API}/login", json={"email": "x@example.com", "password": "nope-nope"}).status_code for _ in range(12)]
    assert codes[:10] == [401] * 10 and codes[10:] == [429, 429]


def test_withdraw_requires_correct_password(user_client):
    assert user_client.request("DELETE", f"{API}/me", json={"password": "wrong-password"}).status_code == 401
    assert user_client.get(f"{API}/me").status_code == 200  # 비밀번호 틀리면 탈퇴 안 됨


def test_withdraw_requires_login(client):
    assert client.request("DELETE", f"{API}/me", json={"password": "password123"}).status_code == 401


def test_withdraw_deactivates_and_logs_out(user_client, db):
    from sqlalchemy import select

    from app.models import User

    assert user_client.request("DELETE", f"{API}/me", json={"password": "password123"}).status_code == 204
    assert user_client.get(f"{API}/me").status_code == 401  # 쿠키도 같이 비워짐

    u = db.scalar(select(User).where(User.nickname == "탈퇴한 회원"))
    assert u is not None and u.is_active is False

    # 비밀번호 재확인으로도 더 이상 못 들어온다(비밀번호 자체가 랜덤값으로 덮어써짐).
    assert user_client.post(f"{API}/login", json={"email": "user@example.com", "password": "password123"}).status_code == 401


def test_withdraw_frees_email_for_reregistration(user_client):
    user_client.request("DELETE", f"{API}/me", json={"password": "password123"})
    r = user_client.post(f"{API}/register", json={"email": "user@example.com", "password": "password123", "nickname": "새계정"})
    assert r.status_code == 201


def test_withdraw_anonymizes_content_instead_of_deleting_it(user_client, world):
    """탈퇴해도 작성한 평가·게시글은 "익명"으로만 바뀌고 그대로 공개 기록에 남는다."""
    rid = user_client.post("/api/v1/reviews", json=review_payload(world["station"].id)).json()["id"]
    pid = user_client.post("/api/v1/posts", json={"region_id": "seoul", "title": "탈퇴 전 글", "body": "본문"}).json()["id"]

    assert user_client.request("DELETE", f"{API}/me", json={"password": "password123"}).status_code == 204

    station = world["station"]
    review_after = [r for r in user_client.get(f"/api/v1/stations/{station.id}").json()["reviews"]["items"] if r["id"] == rid]
    assert review_after and review_after[0]["id"] == rid  # 비로그인으로도 여전히 조회 가능(공개 기록 유지)

    post_after = user_client.get(f"/api/v1/posts/{pid}").json()
    assert post_after["author_nickname"] == "익명" and post_after["is_mine"] is False
