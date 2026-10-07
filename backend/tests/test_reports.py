from conftest import login, make_user
from test_verification import _verified_officer_client

API = "/api/v1"


def post_payload(**over):
    body = {"region_id": "seoul", "title": "신고 테스트 글", "body": "내용"}
    body.update(over)
    return body


def test_create_report_requires_login(client, world):
    rid = world["reviews"][0].id
    assert client.post(f"{API}/reports", json={"target_type": "review", "target_id": rid, "reason": "허위사실 같습니다"}).status_code == 401


def test_create_report_unknown_target_is_404(user_client):
    r = user_client.post(f"{API}/reports", json={"target_type": "review", "target_id": 9999, "reason": "허위사실 같습니다"})
    assert r.status_code == 404


def test_create_report_success_and_duplicate_pending_blocked(user_client, world):
    rid = world["reviews"][0].id
    r = user_client.post(f"{API}/reports", json={"target_type": "review", "target_id": rid, "reason": "허위사실 같습니다"})
    assert r.status_code == 201
    r2 = user_client.post(f"{API}/reports", json={"target_type": "review", "target_id": rid, "reason": "또 신고합니다"})
    assert r2.status_code == 409


def test_report_reason_too_short_is_422(user_client, world):
    rid = world["reviews"][0].id
    r = user_client.post(f"{API}/reports", json={"target_type": "review", "target_id": rid, "reason": "짧음"})
    assert r.status_code == 422


def test_admin_endpoints_require_admin(client, user_client):
    assert client.get(f"{API}/admin/reports").status_code == 401
    assert user_client.get(f"{API}/admin/reports").status_code == 403


def test_admin_list_shows_preview_and_reporter(user_client, admin_client, world):
    rid = world["reviews"][0].id
    user_client.post(f"{API}/reports", json={"target_type": "review", "target_id": rid, "reason": "허위사실 같습니다"})
    q = admin_client.get(f"{API}/admin/reports").json()
    assert q["total"] == 1
    item = q["items"][0]
    assert item["target_type"] == "review" and item["target_id"] == rid
    assert item["target_preview"]  # 리뷰 본문 일부
    assert item["reporter_nickname"] == "tester"  # conftest.make_user 기본 닉네임


def test_admin_resolve_remove_takes_down_review(user_client, admin_client, client, world):
    rid = world["reviews"][0].id
    report_id = user_client.post(f"{API}/reports", json={"target_type": "review", "target_id": rid, "reason": "허위사실 같습니다"}).json()["id"]
    r = admin_client.post(f"{API}/admin/reports/{report_id}/resolve", json={"action": "remove", "note": "확인 결과 삭제 조치"})
    assert r.status_code == 200 and r.json()["status"] == "resolved" and r.json()["resolution_action"] == "removed"

    pub = client.get(f"{API}/stations/{world['station'].id}").json()
    assert all(x["id"] != rid for x in pub["reviews"]["items"])  # 공개 목록에서 사라짐


def test_admin_resolve_dismiss_keeps_content(user_client, admin_client, client, world):
    rid = world["reviews"][0].id
    report_id = user_client.post(f"{API}/reports", json={"target_type": "review", "target_id": rid, "reason": "그냥 마음에 안 듦"}).json()["id"]
    r = admin_client.post(f"{API}/admin/reports/{report_id}/resolve", json={"action": "dismiss", "note": "신고 사유가 부적절함"})
    assert r.status_code == 200 and r.json()["resolution_action"] == "dismissed"

    pub = client.get(f"{API}/stations/{world['station'].id}").json()
    assert any(x["id"] == rid for x in pub["reviews"]["items"])  # 그대로 남아 있음


def test_admin_cannot_resolve_already_resolved_report(user_client, admin_client, world):
    rid = world["reviews"][0].id
    report_id = user_client.post(f"{API}/reports", json={"target_type": "review", "target_id": rid, "reason": "허위사실 같습니다"}).json()["id"]
    admin_client.post(f"{API}/admin/reports/{report_id}/resolve", json={"action": "dismiss", "note": "신고 사유가 부적절함"})
    r = admin_client.post(f"{API}/admin/reports/{report_id}/resolve", json={"action": "remove", "note": "다시 시도"})
    assert r.status_code == 409


def test_report_post_and_remove(user_client, admin_client, client, world):
    pid = user_client.post(f"{API}/posts", json=post_payload()).json()["id"]
    report_id = user_client.post(f"{API}/reports", json={"target_type": "post", "target_id": pid, "reason": "광고성 글입니다"}).json()["id"]
    admin_client.post(f"{API}/admin/reports/{report_id}/resolve", json={"action": "remove", "note": "확인 결과 삭제"})
    assert client.get(f"{API}/posts/{pid}").status_code == 404


def test_report_review_comment_and_remove(user_client, admin_client, world):
    rid = world["reviews"][0].id
    cid = user_client.post(f"{API}/reviews/{rid}/comments", json={"body": "문제될 만한 댓글"}).json()["id"]
    report_id = user_client.post(f"{API}/reports", json={"target_type": "review_comment", "target_id": cid, "reason": "인신공격성 댓글"}).json()["id"]
    admin_client.post(f"{API}/admin/reports/{report_id}/resolve", json={"action": "remove", "note": "확인 결과 삭제"})
    tree = user_client.get(f"{API}/reviews/{rid}/comments").json()
    assert tree[0]["is_removed"] is True


def test_report_review_reply_and_remove_allows_repost(db, client, admin_client, world):
    officer = _verified_officer_client(db, client, world)
    rid = world["reviews"][0].id
    reply_id = officer.post(f"{API}/reviews/{rid}/reply", json={"body": "부적절할 수 있는 해명"}).json()["id"]
    officer.post(f"{API}/auth/logout")

    make_user(db, "reporter@example.com")
    reporter = login(client, "reporter@example.com")
    report_id = reporter.post(
        f"{API}/reports", json={"target_type": "review_reply", "target_id": reply_id, "reason": "사실과 다른 해명"},
    ).json()["id"]

    r = admin_client.post(f"{API}/admin/reports/{report_id}/resolve", json={"action": "remove", "note": "확인 결과 삭제"})
    assert r.status_code == 200 and r.json()["resolution_action"] == "removed"

    # 해명이 하드 삭제됐으니 다른 인증된 경찰관이 다시 해명을 달 수 있다
    officer2 = _verified_officer_client(db, client, world, email="officer2@example.com")
    assert officer2.post(f"{API}/reviews/{rid}/reply", json={"body": "새 해명"}).status_code == 201
