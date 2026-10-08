from conftest import review_payload

API = "/api/v1"


def test_no_login_required(client, world):
    """2026-09 의뢰인 결정: 기본은 익명 비로그인. 2026-10 결정으로 로그인 회원가입도 병행하지만,
    비로그인 제출은 그대로 계속 지원한다."""
    r = client.post(f"{API}/reviews", json=review_payload(world["station"].id))
    assert r.status_code == 201


def test_logged_in_submission_appears_in_mine(user_client, world):
    r = user_client.post(f"{API}/reviews", json=review_payload(world["station"].id))
    assert r.status_code == 201
    review_id = r.json()["id"]

    mine = user_client.get(f"{API}/reviews/mine")
    assert mine.status_code == 200
    items = mine.json()["items"]
    assert any(x["id"] == review_id for x in items)
    hit = next(x for x in items if x["id"] == review_id)
    assert hit["status"] == "published"  # 2026-10 결정: 제출 즉시 게시
    assert "case_number" not in hit  # 본인 것이어도 공개 스키마 원칙상 사건번호는 안 돌려준다


def test_anonymous_submission_not_in_anyones_mine(user_client, client, world):
    r = client.post(f"{API}/reviews", json=review_payload(world["station"].id))  # 비로그인 제출
    assert r.status_code == 201
    mine = user_client.get(f"{API}/reviews/mine").json()
    assert all(x["body"] != review_payload(world["station"].id)["body"] for x in mine["items"])
    assert mine["total"] == 0


def test_mine_requires_login(client, world):
    assert client.get(f"{API}/reviews/mine").status_code == 401


def test_mine_only_shows_own_reviews(db, client, world):
    from conftest import login, make_user

    make_user(db, "a@example.com")
    make_user(db, "b@example.com")
    a = login(client, "a@example.com")
    a.post(f"{API}/reviews", json=review_payload(world["station"].id))
    a.post(f"{API}/auth/logout")

    b = login(client, "b@example.com")
    assert b.get(f"{API}/reviews/mine").json()["total"] == 0


def test_submit_is_published_immediately_and_public(client, world):
    """2026-10 결정: 사전 검수 없이 제출 즉시 게시한다(게시판과 동일한 방식)."""
    r = client.post(f"{API}/reviews", json=review_payload(world["station"].id))
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "published" and "id" in body
    assert "case_number" not in r.text  # 제출 응답에도 사건번호를 되돌려주지 않는다
    # 공개 API 에 바로 나타나고 평점 집계에도 즉시 반영된다(기존 게시 평가 2건 + 방금 1건)
    pub = client.get(f"{API}/stations/{world['station'].id}").json()
    assert pub["reviews"]["total"] == 3 and pub["rating"]["count"] == 3
    assert any("절차에 따라" in x["body"] for x in pub["reviews"]["items"])
    assert client.get(f"{API}/stats/overview").json()["totals"]["reviews"] == 3


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


def test_evidence_note_is_optional_and_unverified_until_admin_acts(user_client, world):
    """제출 시 증빙 메모를 남겨도 운영자가 확인하기 전에는 공개 배지(evidence_verified)가 뜨지 않는다."""
    rid = user_client.post(f"{API}/reviews", json=review_payload(world["station"].id, evidence_note="불기소 결정문 사본 보유")).json()["id"]
    mine = next(x for x in user_client.get(f"{API}/reviews/mine").json()["items"] if x["id"] == rid)
    assert mine["evidence_note"] == "불기소 결정문 사본 보유" and mine["evidence_verified"] is False
    pub = next(x for x in user_client.get(f"{API}/stations/{world['station'].id}").json()["reviews"]["items"] if x["id"] == rid)
    assert pub["evidence_verified"] is False
    assert "evidence_note" not in pub  # 공개 응답에는 메모 원문을 노출하지 않는다(배지 여부만)


def test_station_evidence_only_filter(user_client, admin_client, world):
    sid = world["station"].id
    rid1 = user_client.post(f"{API}/reviews", json=review_payload(sid, evidence_note="증빙 보유")).json()["id"]
    rid2 = user_client.post(f"{API}/reviews", json=review_payload(sid, case_number="2027-형제-00001")).json()["id"]
    admin_client.patch(f"{API}/admin/reviews/{rid1}/evidence", json={"verified": True})

    all_ids = {x["id"] for x in user_client.get(f"{API}/stations/{sid}").json()["reviews"]["items"]}
    assert {rid1, rid2} <= all_ids

    filtered = user_client.get(f"{API}/stations/{sid}", params={"evidence_only": "true"}).json()["reviews"]
    ids = {x["id"] for x in filtered["items"]}
    assert rid1 in ids and rid2 not in ids
