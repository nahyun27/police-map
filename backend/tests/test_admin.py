from conftest import pending_review, review_payload

API = "/api/v1"


def test_admin_endpoints_require_admin(client, user_client):
    paths = [("get", "/admin/reviews"), ("get", "/admin/takedown-requests"), ("get", "/admin/audit-logs"),
             ("post", "/admin/reviews/1/approve"), ("post", "/admin/stations"), ("post", "/admin/officers")]
    for method, path in paths:
        assert getattr(client, method)(f"{API}{path}").status_code == 401, path      # 비로그인
        assert getattr(user_client, method)(f"{API}{path}").status_code == 403, path  # 일반 회원


def _submit(client, station_id, **over):
    """평가 제출은 로그인이 필요 없고(2026-09 결정: 기본 익명), 2026-10 결정으로 제출 즉시 게시된다.
    이 헬퍼로 만든 건은 이미 published 라 approve/reject 대상이 아니다 — 그런 레거시 대기열
    테스트는 conftest.pending_review() 로 DB 에 직접 pending 행을 만들어 쓴다."""
    r = client.post(f"{API}/reviews", json=review_payload(station_id, **over))
    assert r.status_code == 201, r.text
    return r.json()["id"]


def test_queue_shows_case_number_only_to_admin_oldest_first(db, admin_client, world):
    first = pending_review(db, world["station"].id, case_number="사건-AAAA").id
    second = pending_review(db, world["station2"].id, case_number="사건-BBBB").id
    q = admin_client.get(f"{API}/admin/reviews").json()
    assert q["total"] == 2 and [i["id"] for i in q["items"]] == [first, second]
    assert q["items"][0]["case_number"] == "사건-AAAA" and q["items"][0]["status"] == "pending"


def test_approve_publishes_and_updates_aggregates(db, client, admin_client, world):
    rid = pending_review(db, world["station2"].id, fair=5, proc=3, att=None, comm=None, speed=None).id  # 종합 (5+3)/2 = 4.0
    assert client.get(f"{API}/stations/{world['station2'].id}").json()["rating"]["count"] == 0
    r = admin_client.post(f"{API}/admin/reviews/{rid}/approve")
    assert r.status_code == 200 and r.json()["status"] == "published"
    pub = client.get(f"{API}/stations/{world['station2'].id}").json()
    assert pub["rating"]["overall"] == 4.0 and pub["rating"]["count"] == 1 and pub["reviews"]["items"][0]["published_at"]
    assert admin_client.post(f"{API}/admin/reviews/{rid}/approve").status_code == 409  # 재승인 불가


def test_reject_requires_reason_and_stays_private(db, client, admin_client, world):
    rid = pending_review(db, world["station2"].id).id
    assert admin_client.post(f"{API}/admin/reviews/{rid}/reject", json={"reason": "짧"}).status_code == 422
    assert admin_client.post(f"{API}/admin/reviews/{rid}/reject", json={"reason": "직무와 무관한 내용이 포함되어 있습니다"}).status_code == 200
    assert client.get(f"{API}/stations/{world['station2'].id}").json()["rating"]["count"] == 0
    rejected = admin_client.get(f"{API}/admin/reviews", params={"status": "rejected"}).json()["items"][0]
    assert rejected["status"] == "rejected" and "직무와 무관" in rejected["reject_reason"]  # 사유가 저장돼 있다
    assert admin_client.post(f"{API}/admin/reviews/{rid}/approve").status_code == 409  # 반려 후 승인 불가


def test_admin_list_filter_by_status(db, admin_client, world):
    rid = pending_review(db, world["station"].id).id
    assert admin_client.post(f"{API}/admin/reviews/{rid}/approve").status_code == 200
    assert admin_client.get(f"{API}/admin/reviews").json()["total"] == 0
    assert admin_client.get(f"{API}/admin/reviews", params={"status": "published"}).json()["total"] == 3  # 시드 2 + 방금 1
    assert admin_client.get(f"{API}/admin/reviews", params={"status": "bogus"}).status_code == 422


def test_audit_log_records_every_admin_action(db, admin_client, world):
    rid = pending_review(db, world["station"].id).id
    admin_client.post(f"{API}/admin/reviews/{rid}/approve")
    rid2 = pending_review(db, world["station2"].id).id
    admin_client.post(f"{API}/admin/reviews/{rid2}/reject", json={"reason": "사유가 충분히 긴 반려 사유"})
    logs = admin_client.get(f"{API}/admin/audit-logs").json()
    assert [l["action"] for l in logs["items"]] == ["review_rejected", "review_approved"]  # 최신순
    assert logs["items"][0]["detail"] == {"reason": "사유가 충분히 긴 반려 사유"} and logs["items"][0]["actor_id"]
    assert logs["items"][0]["actor_email"]  # 관리자 화면에서 바로 누가 처리했는지 보이도록
    assert admin_client.get(f"{API}/admin/audit-logs", params={"action": "review_approved"}).json()["total"] == 1
    # 감사 로그는 읽기 전용: 수정·삭제 경로가 없다
    assert admin_client.delete(f"{API}/admin/audit-logs/1").status_code in (404, 405)


def test_submit_is_published_immediately_and_appears_publicly(client, world):
    """2026-10 결정: 평가는 더 이상 검수 대기를 거치지 않고 제출 즉시 게시된다(게시판과 동일한 방식)."""
    rid = _submit(client, world["station"].id, body="즉시게시 회귀 테스트")
    pub = client.get(f"{API}/stations/{world['station'].id}").json()
    assert pub["rating"]["count"] == 3  # 시드 2 + 방금 1
    assert any(x["id"] == rid and x["body"] == "즉시게시 회귀 테스트" for x in pub["reviews"]["items"])


def test_admin_can_remove_published_review_post_hoc(client, admin_client, world):
    rid = world["reviews"][0].id  # 이미 published 된 시드 평가
    assert admin_client.post(f"{API}/admin/reviews/{rid}/remove", json={"reason": "직무와 무관한 허위 사실"}).status_code == 200
    assert client.get(f"{API}/stations/{world['station'].id}").json()["rating"]["count"] == 1  # 시드 2건 중 1건만 남음
    removed = admin_client.get(f"{API}/admin/reviews", params={"status": "removed"}).json()["items"][0]
    assert removed["id"] == rid and "직무와 무관" in removed["reject_reason"]
    # 이미 삭제된 건 다시 삭제 불가, 대기열 상태가 아닌 건 approve/reject 대상도 아니다
    assert admin_client.post(f"{API}/admin/reviews/{rid}/remove", json={"reason": "다시 사유 입력"}).status_code == 409
    assert admin_client.post(f"{API}/admin/reviews/{rid}/approve").status_code == 409


def test_admin_cannot_remove_pending_review(db, admin_client, world):
    """레거시 대기열 건은 approve/reject 로만 처리한다 — remove 의 대상이 아니다."""
    rid = pending_review(db, world["station"].id).id
    assert admin_client.post(f"{API}/admin/reviews/{rid}/remove", json={"reason": "사유 충분히 길게"}).status_code == 409


def test_admin_can_toggle_evidence_badge(client, admin_client, world):
    rid = world["reviews"][0].id
    assert client.get(f"{API}/stations/{world['station'].id}").json()["reviews"]["items"][0]["evidence_verified"] is False
    r = admin_client.patch(f"{API}/admin/reviews/{rid}/evidence", json={"verified": True})
    assert r.status_code == 200 and r.json()["evidence_verified"] is True
    pub = client.get(f"{API}/stations/{world['station'].id}").json()
    hit = next(x for x in pub["reviews"]["items"] if x["id"] == rid)
    assert hit["evidence_verified"] is True
    # 되돌리기도 가능
    assert admin_client.patch(f"{API}/admin/reviews/{rid}/evidence", json={"verified": False}).json()["evidence_verified"] is False


def test_takedown_is_audited_with_system_actor(client, admin_client, world):
    from conftest import takedown_payload
    client.post(f"{API}/takedown-requests", json=takedown_payload(target_id=world["reviews"][0].id))
    logs = admin_client.get(f"{API}/admin/audit-logs", params={"action": "takedown_received"}).json()
    assert logs["total"] == 1 and logs["items"][0]["actor_id"] is None  # 비회원 접수 = 시스템 기록


def test_create_station_and_officer(admin_client, client, world):
    """수사관은 개인 단위 평가가 재도입될 때까지 공개 화면에 노출되지 않으므로, 여기서는 관리자 응답만 검증한다."""
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
    assert o.status_code == 201
    assert o.json()["department"] == "형사과" and o.json()["source_label"] == "인사발령 공고"
    assert o.json()["assignments"][0]["period"] == "2025.03"


def test_officer_source_is_required_and_validated(admin_client, world):
    base = {"station_id": world["station"].id, "name": "무출처", "rank": "경장"}
    assert admin_client.post(f"{API}/admin/officers", json=base).status_code == 422  # 출처 없이는 게재 불가
    assert admin_client.post(f"{API}/admin/officers", json={**base, "source": "rumor"}).status_code == 422
    assert admin_client.post(f"{API}/admin/officers", json={**base, "source": "media", "station_id": 9999}).status_code == 404


def test_patch_officer_unpublish_and_replace_assignments(admin_client, world):
    oid = world["officer"].id
    r = admin_client.patch(f"{API}/admin/officers/{oid}", json={"rank": "경감", "assignments": [{"period": "2026.01", "description": "테스트경찰서 수사과"}]})
    assert r.status_code == 200 and r.json()["rank"] == "경감" and len(r.json()["assignments"]) == 1
    r2 = admin_client.patch(f"{API}/admin/officers/{oid}", json={"is_published": False})
    assert r2.status_code == 200 and r2.json()["is_published"] is False
    assert admin_client.patch(f"{API}/admin/officers/9999", json={"rank": "경감"}).status_code == 404
