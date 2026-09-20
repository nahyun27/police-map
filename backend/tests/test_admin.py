from conftest import review_payload

API = "/api/v1"


def test_admin_endpoints_require_admin(client, user_client):
    paths = [("get", "/admin/reviews"), ("get", "/admin/takedown-requests"), ("get", "/admin/audit-logs"),
             ("post", "/admin/reviews/1/approve"), ("post", "/admin/stations"), ("post", "/admin/officers")]
    for method, path in paths:
        assert getattr(client, method)(f"{API}{path}").status_code == 401, path      # 비로그인
        assert getattr(user_client, method)(f"{API}{path}").status_code == 403, path  # 일반 회원


def _submit(user_client, officer_id, **over):
    r = user_client.post(f"{API}/reviews", json=review_payload(officer_id, **over))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_queue_shows_case_number_only_to_admin_oldest_first(user_client, admin_client, world):
    first = _submit(user_client, world["a"].id, case_number="사건-AAAA")
    second = _submit(user_client, world["b"].id, case_number="사건-BBBB")
    q = admin_client.get(f"{API}/admin/reviews").json()
    assert q["total"] == 2 and [i["id"] for i in q["items"]] == [first, second]
    assert q["items"][0]["case_number"] == "사건-AAAA" and q["items"][0]["status"] == "pending"


def test_approve_publishes_and_updates_aggregates(user_client, admin_client, client, world):
    rid = _submit(user_client, world["b"].id, ratings={"fair": 5, "proc": 3})  # 종합 (5+3)/2 = 4.0
    assert client.get(f"{API}/officers/{world['b'].id}").json()["rating"]["count"] == 0
    r = admin_client.post(f"{API}/admin/reviews/{rid}/approve")
    assert r.status_code == 200 and r.json()["status"] == "published"
    pub = client.get(f"{API}/officers/{world['b'].id}").json()
    assert pub["rating"]["overall"] == 4.0 and pub["rating"]["count"] == 1 and pub["reviews"]["items"][0]["published_at"]
    assert admin_client.post(f"{API}/admin/reviews/{rid}/approve").status_code == 409  # 재승인 불가
    assert user_client.get(f"{API}/reviews/mine").json()[0]["status"] == "published"


def test_reject_requires_reason_and_stays_private(user_client, admin_client, client, world):
    rid = _submit(user_client, world["b"].id)
    assert admin_client.post(f"{API}/admin/reviews/{rid}/reject", json={"reason": "짧"}).status_code == 422
    assert admin_client.post(f"{API}/admin/reviews/{rid}/reject", json={"reason": "직무와 무관한 내용이 포함되어 있습니다"}).status_code == 200
    assert client.get(f"{API}/officers/{world['b'].id}").json()["rating"]["count"] == 0
    mine = user_client.get(f"{API}/reviews/mine").json()[0]
    assert mine["status"] == "rejected" and "직무와 무관" in mine["reject_reason"]  # 작성자에게는 사유 통지
    assert admin_client.post(f"{API}/admin/reviews/{rid}/approve").status_code == 409  # 반려 후 승인 불가


def test_admin_list_filter_by_status(user_client, admin_client, world):
    rid = _submit(user_client, world["a"].id)
    admin_client.post(f"{API}/admin/reviews/{rid}/approve")
    assert admin_client.get(f"{API}/admin/reviews").json()["total"] == 0
    assert admin_client.get(f"{API}/admin/reviews", params={"status": "published"}).json()["total"] == 3  # 시드 2 + 방금 1
    assert admin_client.get(f"{API}/admin/reviews", params={"status": "bogus"}).status_code == 422


def test_audit_log_records_every_admin_action(user_client, admin_client, world):
    rid = _submit(user_client, world["a"].id)
    admin_client.post(f"{API}/admin/reviews/{rid}/approve")
    rid2 = _submit(user_client, world["b"].id)
    admin_client.post(f"{API}/admin/reviews/{rid2}/reject", json={"reason": "사유가 충분히 긴 반려 사유"})
    logs = admin_client.get(f"{API}/admin/audit-logs").json()
    assert [l["action"] for l in logs["items"]] == ["review_rejected", "review_approved"]  # 최신순
    assert logs["items"][0]["detail"] == {"reason": "사유가 충분히 긴 반려 사유"} and logs["items"][0]["actor_id"]
    assert admin_client.get(f"{API}/admin/audit-logs", params={"action": "review_approved"}).json()["total"] == 1
    # 감사 로그는 읽기 전용: 수정·삭제 경로가 없다
    assert admin_client.delete(f"{API}/admin/audit-logs/1").status_code in (404, 405)


def test_takedown_is_audited_with_system_actor(client, admin_client, world):
    from conftest import takedown_payload
    client.post(f"{API}/takedown-requests", json=takedown_payload(target_id=world["reviews"][0].id))
    logs = admin_client.get(f"{API}/admin/audit-logs", params={"action": "takedown_received"}).json()
    assert logs["total"] == 1 and logs["items"][0]["actor_id"] is None  # 비회원 접수 = 시스템 기록


def test_create_station_and_officer_then_visible(admin_client, client, world):
    s = admin_client.post(f"{API}/admin/stations", json={"region_id": "seoul", "name": "신규경찰서", "department_names": ["수사과", "수사과", "형사과"]})
    assert s.status_code == 201
    assert admin_client.post(f"{API}/admin/stations", json={"region_id": "seoul", "name": "신규경찰서"}).status_code == 409
    assert admin_client.post(f"{API}/admin/stations", json={"region_id": "nope", "name": "어딘가경찰서"}).status_code == 404
    sid = s.json()["id"]
    assert client.get(f"{API}/stations/{sid}").json()["departments"] == ["수사과", "형사과"]  # 중복 제거

    o = admin_client.post(f"{API}/admin/officers", json={
        "station_id": sid, "name": "신규수사", "rank": "경장", "source": "announcement", "department_name": "형사과",
        "assignments": [{"period": "2025.03", "description": "신규경찰서 형사과"}],
    })
    assert o.status_code == 201 and o.json()["department"] == "형사과"
    detail = client.get(f"{API}/officers/{o.json()['id']}").json()
    assert detail["source_label"] == "인사발령 공고" and detail["assignments"][0]["period"] == "2025.03"


def test_officer_source_is_required_and_validated(admin_client, world):
    base = {"station_id": world["station"].id, "name": "무출처", "rank": "경장"}
    assert admin_client.post(f"{API}/admin/officers", json=base).status_code == 422  # 출처 없이는 게재 불가
    assert admin_client.post(f"{API}/admin/officers", json={**base, "source": "rumor"}).status_code == 422
    assert admin_client.post(f"{API}/admin/officers", json={**base, "source": "media", "station_id": 9999}).status_code == 404


def test_patch_officer_unpublish_and_replace_assignments(admin_client, client, world):
    oid = world["a"].id
    r = admin_client.patch(f"{API}/admin/officers/{oid}", json={"rank": "경감", "assignments": [{"period": "2026.01", "description": "테스트경찰서 수사과"}]})
    assert r.status_code == 200 and r.json()["rank"] == "경감" and len(r.json()["assignments"]) == 1
    assert admin_client.patch(f"{API}/admin/officers/{oid}", json={"is_published": False}).status_code == 200
    assert client.get(f"{API}/officers/{oid}").status_code == 404
    assert admin_client.patch(f"{API}/admin/officers/9999", json={"rank": "경감"}).status_code == 404
