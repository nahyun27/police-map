from conftest import make_user

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
