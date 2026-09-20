from conftest import login, make_user, review_payload

API = "/api/v1"


def test_login_required(client, world):
    assert client.post(f"{API}/reviews", json=review_payload(world["a"].id)).status_code == 401
    assert client.get(f"{API}/reviews/mine").status_code == 401


def test_submit_is_pending_and_not_public(user_client, client, world):
    r = user_client.post(f"{API}/reviews", json=review_payload(world["a"].id))
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "pending" and body["officer_name"] == "가상갑"
    assert "case_number" not in r.text  # 작성자에게도 사건번호를 되돌려주지 않는다
    # 공개 API 어디에도 나타나지 않고 평점 집계에도 반영되지 않는다(기존 게시 평가 2건 그대로)
    pub = client.get(f"{API}/officers/{world['a'].id}").json()
    assert pub["reviews"]["total"] == 2 and pub["rating"]["count"] == 2
    assert all("절차에 따라" not in x["body"] for x in pub["reviews"]["items"])
    assert client.get(f"{API}/stats/overview").json()["totals"]["reviews"] == 2
    mine = user_client.get(f"{API}/reviews/mine").json()
    assert len(mine) == 1 and mine[0]["status"] == "pending"


def test_banned_expression_rejected_with_list(user_client, world):
    r = user_client.post(f"{API}/reviews", json=review_payload(world["a"].id, body="이 사람은 정말 무능하고 쓰레기 같았다"))
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert set(detail["banned"]) == {"무능", "쓰레기"}


def test_ordinary_words_containing_gae_are_not_blocked(user_client, world):
    """회귀 방지: 예전 프로토타입은 '개' 한 글자를 금칙어로 잡아 '3개월', '개인' 이 든 정상 후기를 막았다."""
    text = "보완수사 요청 후 3개월간 연락이 없었고 개인적으로 여러 차례 문의했습니다."
    assert user_client.post(f"{API}/reviews", json=review_payload(world["a"].id, body=text)).status_code == 201


def test_at_least_one_rating_and_range(user_client, world):
    o = world["a"].id
    assert user_client.post(f"{API}/reviews", json=review_payload(o, ratings={})).status_code == 422
    assert user_client.post(f"{API}/reviews", json=review_payload(o, ratings={"fair": None})).status_code == 422
    assert user_client.post(f"{API}/reviews", json=review_payload(o, ratings={"fair": 0})).status_code == 422
    assert user_client.post(f"{API}/reviews", json=review_payload(o, ratings={"fair": 6})).status_code == 422
    assert user_client.post(f"{API}/reviews", json=review_payload(o, ratings={"fair": 5})).status_code == 201


def test_input_validation(user_client, world):
    o = world["a"].id
    assert user_client.post(f"{API}/reviews", json=review_payload(o, case_number="12")).status_code == 422  # 사건번호 필수
    assert user_client.post(f"{API}/reviews", json=review_payload(o, role="police")).status_code == 422
    assert user_client.post(f"{API}/reviews", json=review_payload(o, body="가" * 2001)).status_code == 422


def test_duplicate_same_case_is_409_even_if_formatted_differently(user_client, world):
    o = world["a"].id
    assert user_client.post(f"{API}/reviews", json=review_payload(o, case_number="2026-형제-12345")).status_code == 201
    for variant in ("2026-형제-12345", " 2026 형제 12345 ", "2026_형제_12345"):
        assert user_client.post(f"{API}/reviews", json=review_payload(o, case_number=variant)).status_code == 409
    # 다른 사건이면 같은 수사관도 다시 평가할 수 있다
    assert user_client.post(f"{API}/reviews", json=review_payload(o, case_number="2027-형제-99999")).status_code == 201


def test_different_users_may_review_same_case_number(db, world):
    from fastapi.testclient import TestClient
    from app.main import app
    make_user(db, "u1@example.com")
    make_user(db, "u2@example.com")
    for email in ("u1@example.com", "u2@example.com"):
        c = login(TestClient(app), email)
        assert c.post(f"{API}/reviews", json=review_payload(world["a"].id)).status_code == 201


def test_unknown_or_hidden_officer_is_404(user_client, world, db):
    assert user_client.post(f"{API}/reviews", json=review_payload(9999)).status_code == 404
    world["b"].is_blinded = True
    db.commit()
    assert user_client.post(f"{API}/reviews", json=review_payload(world["b"].id)).status_code == 404


def test_identity_verification_gate(db, world):
    from fastapi.testclient import TestClient
    from app.core.config import settings
    from app.main import app
    make_user(db, "plain@example.com")
    make_user(db, "verified@example.com", verified=True)
    settings.REQUIRE_IDENTITY_VERIFICATION = True
    plain = login(TestClient(app), "plain@example.com")
    verified = login(TestClient(app), "verified@example.com")
    assert plain.post(f"{API}/reviews", json=review_payload(world["a"].id)).status_code == 403
    assert verified.post(f"{API}/reviews", json=review_payload(world["a"].id)).status_code == 201


def test_my_reviews_are_private_to_author(db, world, user_client):
    from fastapi.testclient import TestClient
    from app.main import app
    user_client.post(f"{API}/reviews", json=review_payload(world["a"].id))
    make_user(db, "other@example.com")
    other = login(TestClient(app), "other@example.com")
    assert other.get(f"{API}/reviews/mine").json() == []
