from conftest import takedown_payload

API = "/api/v1"


def _review_id(world):
    return world["reviews"][0].id


def test_review_takedown_blinds_immediately(client, world):
    rid = _review_id(world)
    r = client.post(f"{API}/takedown-requests", json=takedown_payload(target_id=rid))
    assert r.status_code == 201
    receipt = r.json()
    assert receipt["status"] == "pending" and receipt["public_code"]
    # 즉시 공개 목록·집계에서 빠진다(정책: 접수 즉시 임시조치)
    pub = client.get(f"{API}/officers/{world['a'].id}").json()
    assert pub["reviews"]["total"] == 1 and all(x["id"] != rid for x in pub["reviews"]["items"])
    assert pub["rating"]["count"] == 1 and pub["rating"]["overall"] == 4.0  # 남은 4점 평가만


def test_status_lookup_hides_requester_info(client, world):
    rid = _review_id(world)
    code = client.post(f"{API}/takedown-requests", json=takedown_payload(target_id=rid)).json()["public_code"]
    s = client.get(f"{API}/takedown-requests/{code}")
    assert s.status_code == 200 and s.json()["status"] == "pending"
    assert "hong@example.com" not in s.text and "홍길동" not in s.text
    assert client.get(f"{API}/takedown-requests/does-not-exist").status_code == 404


def test_cannot_target_unpublished_review(client, world, db):
    from app.models import ReviewStatus
    world["reviews"][0].status = ReviewStatus.pending
    db.commit()
    assert client.post(f"{API}/takedown-requests", json=takedown_payload(target_id=_review_id(world))).status_code == 404
    assert client.post(f"{API}/takedown-requests", json=takedown_payload(target_id=9999)).status_code == 404


def test_officer_takedown_hides_profile_and_reviews(client, world):
    r = client.post(f"{API}/takedown-requests", json=takedown_payload(target_type="officer", target_id=world["a"].id, request_type="correct"))
    assert r.status_code == 201
    assert client.get(f"{API}/officers/{world['a'].id}").status_code == 404
    st = client.get(f"{API}/stations/{world['station'].id}").json()
    assert [o["name"] for o in st["officers"]] == ["가상을"] and st["rating"]["count"] == 0


def test_validation(client, world):
    rid = _review_id(world)
    assert client.post(f"{API}/takedown-requests", json=takedown_payload(target_id=rid, reason="짧음")).status_code == 422
    assert client.post(f"{API}/takedown-requests", json=takedown_payload(target_id=rid, relation="친구")).status_code == 422
    # 검증에 실패한 요청은 접수·임시조치되지 않는다
    assert client.get(f"{API}/officers/{world['a'].id}").json()["reviews"]["total"] == 2


def test_rate_limit_is_5_per_hour_and_counts_invalid_requests_too(client, world):
    rid = _review_id(world)
    codes = [client.post(f"{API}/takedown-requests", json=takedown_payload(target_id=rid)).status_code for _ in range(6)]
    assert codes == [201] * 5 + [429]  # 남용 방지: 시간당 5건
    from app.core.rate_limit import takedown_limiter
    takedown_limiter.reset()
    # 속도 제한은 입력 검증보다 먼저 동작하므로, 잘못된 요청도 횟수에 포함된다(무차별 시도 차단)
    bad = [client.post(f"{API}/takedown-requests", json=takedown_payload(target_id=rid, reason="짧음")).status_code for _ in range(6)]
    assert bad == [422] * 5 + [429]


def test_resolve_keep_restores(client, admin_client, world):
    rid = _review_id(world)
    t = client.post(f"{API}/takedown-requests", json=takedown_payload(target_id=rid)).json()
    tid = admin_client.get(f"{API}/admin/takedown-requests").json()["items"][0]["id"]
    r = admin_client.post(f"{API}/admin/takedown-requests/{tid}/resolve", json={"decision": "keep", "note": "사실관계 확인 결과 게시 유지"})
    assert r.status_code == 200 and r.json()["status"] == "kept"
    assert client.get(f"{API}/officers/{world['a'].id}").json()["reviews"]["total"] == 2  # 복원
    s = client.get(f"{API}/takedown-requests/{t['public_code']}").json()
    assert s["status"] == "kept" and "게시 유지" in s["resolution_note"]
    assert admin_client.post(f"{API}/admin/takedown-requests/{tid}/resolve", json={"decision": "keep", "note": "다시 처리"}).status_code == 409


def test_keep_does_not_unblind_while_another_request_is_pending(client, admin_client, world):
    rid = _review_id(world)
    client.post(f"{API}/takedown-requests", json=takedown_payload(target_id=rid))
    client.post(f"{API}/takedown-requests", json=takedown_payload(target_id=rid, requester_name="김철수"))
    ids = [i["id"] for i in admin_client.get(f"{API}/admin/takedown-requests").json()["items"]]
    admin_client.post(f"{API}/admin/takedown-requests/{ids[0]}/resolve", json={"decision": "keep", "note": "첫 요청 기각"})
    assert client.get(f"{API}/officers/{world['a'].id}").json()["reviews"]["total"] == 1  # 아직 블라인드
    admin_client.post(f"{API}/admin/takedown-requests/{ids[1]}/resolve", json={"decision": "keep", "note": "둘째 요청도 기각"})
    assert client.get(f"{API}/officers/{world['a'].id}").json()["reviews"]["total"] == 2


def test_resolve_remove_closes_sibling_requests(client, admin_client, world):
    rid = _review_id(world)
    codes = [client.post(f"{API}/takedown-requests", json=takedown_payload(target_id=rid)).json()["public_code"] for _ in range(2)]
    first = admin_client.get(f"{API}/admin/takedown-requests").json()["items"][0]["id"]
    admin_client.post(f"{API}/admin/takedown-requests/{first}/resolve", json={"decision": "remove", "note": "허위 사실로 확인되어 삭제"})
    assert [client.get(f"{API}/takedown-requests/{c}").json()["status"] for c in codes] == ["removed", "removed"]
    assert admin_client.get(f"{API}/admin/takedown-requests").json()["total"] == 0
    assert client.get(f"{API}/officers/{world['a'].id}").json()["reviews"]["total"] == 1  # 영구 비공개


def test_officer_remove_unpublishes(client, admin_client, world):
    client.post(f"{API}/takedown-requests", json=takedown_payload(target_type="officer", target_id=world["a"].id))
    tid = admin_client.get(f"{API}/admin/takedown-requests").json()["items"][0]["id"]
    admin_client.post(f"{API}/admin/takedown-requests/{tid}/resolve", json={"decision": "remove", "note": "정보주체 요청에 따라 삭제"})
    assert client.get(f"{API}/officers/{world['a'].id}").status_code == 404


def test_overdue_flag(client, admin_client, world, db):
    from datetime import datetime, timedelta, timezone
    from app.models import TakedownRequest
    client.post(f"{API}/takedown-requests", json=takedown_payload(target_id=_review_id(world)))
    item = admin_client.get(f"{API}/admin/takedown-requests").json()["items"][0]
    assert item["overdue"] is False  # 접수 직후: 기한(10일) 이내
    t = db.get(TakedownRequest, item["id"])
    t.due_at = datetime.now(timezone.utc) - timedelta(days=1)
    db.commit()
    assert admin_client.get(f"{API}/admin/takedown-requests").json()["items"][0]["overdue"] is True
