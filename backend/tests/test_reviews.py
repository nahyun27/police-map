from conftest import review_payload

API = "/api/v1"


def test_no_login_required(client, world):
    """2026-09 의뢰인 결정: 기본은 익명 비로그인. 회원가입은 향후 과금 단계에서만."""
    r = client.post(f"{API}/reviews", json=review_payload(world["station"].id))
    assert r.status_code == 201


def test_submit_is_pending_and_not_public(client, world):
    r = client.post(f"{API}/reviews", json=review_payload(world["station"].id))
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "pending" and "id" in body
    assert "case_number" not in r.text  # 제출 응답에도 사건번호를 되돌려주지 않는다
    # 공개 API 어디에도 나타나지 않고 평점 집계에도 반영되지 않는다(기존 게시 평가 2건 그대로)
    pub = client.get(f"{API}/stations/{world['station'].id}").json()
    assert pub["reviews"]["total"] == 2 and pub["rating"]["count"] == 2
    assert all("절차에 따라" not in x["body"] for x in pub["reviews"]["items"])
    assert client.get(f"{API}/stats/overview").json()["totals"]["reviews"] == 2


def test_banned_expression_rejected_with_list(client, world):
    r = client.post(f"{API}/reviews", json=review_payload(world["station"].id, body="이 사람은 정말 무능하고 쓰레기 같았다"))
    assert r.status_code == 422
    detail = r.json()["detail"]
    assert set(detail["banned"]) == {"무능", "쓰레기"}


def test_ordinary_words_containing_gae_are_not_blocked(client, world):
    """회귀 방지: 예전 프로토타입은 '개' 한 글자를 금칙어로 잡아 '3개월', '개인' 이 든 정상 후기를 막았다."""
    text = "보완수사 요청 후 3개월간 연락이 없었고 개인적으로 여러 차례 문의했습니다."
    assert client.post(f"{API}/reviews", json=review_payload(world["station"].id, body=text)).status_code == 201


def test_at_least_one_rating_and_range(client, world):
    s = world["station"].id
    assert client.post(f"{API}/reviews", json=review_payload(s, ratings={})).status_code == 422
    assert client.post(f"{API}/reviews", json=review_payload(s, ratings={"fair": None})).status_code == 422
    assert client.post(f"{API}/reviews", json=review_payload(s, ratings={"fair": 0})).status_code == 422
    assert client.post(f"{API}/reviews", json=review_payload(s, ratings={"fair": 6})).status_code == 422
    assert client.post(f"{API}/reviews", json=review_payload(s, ratings={"fair": 5})).status_code == 201


def test_case_number_is_optional(client, world):
    """2026-09 의뢰인 결정: 사건번호는 선택 입력. 비워도 제출할 수 있고, 여러 건 제출해도 중복 판정되지 않는다."""
    s = world["station"].id
    assert client.post(f"{API}/reviews", json=review_payload(s, case_number=None)).status_code == 201
    assert client.post(f"{API}/reviews", json=review_payload(s, case_number=None)).status_code == 201
    assert client.post(f"{API}/reviews", json=review_payload(s, case_number="")).status_code == 201  # 빈 문자열도 "미입력"으로 취급


def test_case_number_if_given_must_be_reasonable(client, world):
    assert client.post(f"{API}/reviews", json=review_payload(world["station"].id, case_number="12")).status_code == 422


def test_input_validation(client, world):
    s = world["station"].id
    assert client.post(f"{API}/reviews", json=review_payload(s, role="police")).status_code == 422
    assert client.post(f"{API}/reviews", json=review_payload(s, body="가" * 2001)).status_code == 422


def test_duplicate_same_case_is_409_even_if_formatted_differently(client, world):
    s = world["station"].id
    assert client.post(f"{API}/reviews", json=review_payload(s, case_number="2026-형제-12345")).status_code == 201
    for variant in ("2026-형제-12345", " 2026 형제 12345 ", "2026_형제_12345"):
        assert client.post(f"{API}/reviews", json=review_payload(s, case_number=variant)).status_code == 409
    # 다른 사건이면 같은 경찰서도 다시 평가할 수 있다
    assert client.post(f"{API}/reviews", json=review_payload(s, case_number="2027-형제-99999")).status_code == 201
    # 같은 사건번호라도 다른 경찰서면 충돌하지 않는다
    assert client.post(f"{API}/reviews", json=review_payload(world["station2"].id, case_number="2026-형제-12345")).status_code == 201


def test_unknown_station_is_404(client):
    assert client.post(f"{API}/reviews", json=review_payload(9999)).status_code == 404
