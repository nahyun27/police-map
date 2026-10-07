API = "/api/v1"


# ---------- 평가 스크랩 ----------
def test_review_scrap_requires_login(client, world):
    rid = world["reviews"][0].id
    assert client.post(f"{API}/reviews/{rid}/scrap").status_code == 401


def test_review_scrap_toggle(user_client, world):
    rid = world["reviews"][0].id
    r = user_client.post(f"{API}/reviews/{rid}/scrap")
    assert r.status_code == 200 and r.json() == {"scrapped": True}

    pub = user_client.get(f"{API}/stations/{world['station'].id}").json()
    hit = next(x for x in pub["reviews"]["items"] if x["id"] == rid)
    assert hit["is_scrapped"] is True

    r2 = user_client.delete(f"{API}/reviews/{rid}/scrap")
    assert r2.status_code == 200 and r2.json() == {"scrapped": False}
    pub2 = user_client.get(f"{API}/stations/{world['station'].id}").json()
    hit2 = next(x for x in pub2["reviews"]["items"] if x["id"] == rid)
    assert hit2["is_scrapped"] is False


def test_review_scrap_idempotent(user_client, world):
    rid = world["reviews"][0].id
    assert user_client.post(f"{API}/reviews/{rid}/scrap").status_code == 200
    assert user_client.post(f"{API}/reviews/{rid}/scrap").status_code == 200  # 중복 스크랩해도 에러 없음


def test_review_scraps_listed_in_scrap_order(user_client, world):
    r0, r1 = world["reviews"][0].id, world["reviews"][1].id
    user_client.post(f"{API}/reviews/{r0}/scrap")
    user_client.post(f"{API}/reviews/{r1}/scrap")  # 나중에 스크랩

    mine = user_client.get(f"{API}/reviews/scraps").json()
    assert mine["total"] == 2
    assert [x["id"] for x in mine["items"]] == [r1, r0]  # 최신 스크랩이 먼저
    assert all(x["is_scrapped"] for x in mine["items"])


def test_review_scraps_only_shows_own(db, client, world):
    from conftest import login, make_user

    make_user(db, "a@example.com")
    make_user(db, "b@example.com")
    a = login(client, "a@example.com")
    a.post(f"{API}/reviews/{world['reviews'][0].id}/scrap")
    a.post(f"{API}/auth/logout")

    b = login(client, "b@example.com")
    assert b.get(f"{API}/reviews/scraps").json()["total"] == 0


def test_review_scrap_unknown_review_is_404(user_client):
    assert user_client.post(f"{API}/reviews/9999/scrap").status_code == 404


# ---------- 게시판 글 스크랩 ----------
def post_payload(**over):
    body = {"region_id": "seoul", "title": "스크랩 테스트 글", "body": "내용"}
    body.update(over)
    return body


def test_post_scrap_toggle_and_list(user_client, world):
    pid = user_client.post(f"{API}/posts", json=post_payload()).json()["id"]
    r = user_client.post(f"{API}/posts/{pid}/scrap")
    assert r.status_code == 200 and r.json() == {"scrapped": True}

    detail = user_client.get(f"{API}/posts/{pid}").json()
    assert detail["is_scrapped"] is True

    mine = user_client.get(f"{API}/me/scraps/posts").json()
    assert mine["total"] == 1 and mine["items"][0]["id"] == pid

    user_client.delete(f"{API}/posts/{pid}/scrap")
    assert user_client.get(f"{API}/posts/{pid}").json()["is_scrapped"] is False
    assert user_client.get(f"{API}/me/scraps/posts").json()["total"] == 0


def test_post_scrap_disappears_when_post_removed(user_client, world):
    pid = user_client.post(f"{API}/posts", json=post_payload()).json()["id"]
    user_client.post(f"{API}/posts/{pid}/scrap")
    user_client.delete(f"{API}/posts/{pid}")
    assert user_client.get(f"{API}/me/scraps/posts").json()["items"] == []
