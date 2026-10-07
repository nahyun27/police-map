from conftest import login, make_user

API = "/api/v1"


# ---------- 관심 지역 ----------
def test_follow_requires_login(client, world):
    assert client.get(f"{API}/me/regions").status_code == 401
    assert client.post(f"{API}/me/regions/seoul").status_code == 401


def test_follow_and_unfollow_region(user_client, world):
    assert user_client.get(f"{API}/me/regions").json() == []
    r = user_client.post(f"{API}/me/regions/seoul")
    assert r.status_code == 201 and r.json()["region_id"] == "seoul"

    mine = user_client.get(f"{API}/me/regions").json()
    assert [x["region_id"] for x in mine] == ["seoul"]

    # 중복 등록해도 에러 없이 한 건으로 유지된다
    assert user_client.post(f"{API}/me/regions/seoul").status_code == 201
    assert len(user_client.get(f"{API}/me/regions").json()) == 1

    assert user_client.delete(f"{API}/me/regions/seoul").status_code == 204
    assert user_client.get(f"{API}/me/regions").json() == []


def test_follow_unknown_region_is_404(user_client):
    assert user_client.post(f"{API}/me/regions/not-a-region").status_code == 404


def test_recent_reviews_filtered_by_region(client, db, world):
    from app.models import Region, Station

    db.add(Region(id="busan", name="부산", full_name="부산경찰청", station_total=1))
    db.flush()
    other = Station(region_id="busan", name="부산경찰서")
    db.add(other)
    db.commit()

    all_recent = client.get(f"{API}/reviews/recent?limit=10").json()
    assert len(all_recent) == 2  # world 픽스처의 서울 평가 2건

    seoul_only = client.get(f"{API}/reviews/recent?limit=10&region=seoul").json()
    assert len(seoul_only) == 2
    busan_only = client.get(f"{API}/reviews/recent?limit=10&region=busan").json()
    assert busan_only == []


# ---------- 평가 댓글/추천 ----------
def test_review_comment_requires_login(client, world):
    rid = world["reviews"][0].id
    assert client.post(f"{API}/reviews/{rid}/comments", json={"body": "익명 댓글"}).status_code == 401


def test_review_comment_create_and_list(user_client, world):
    rid = world["reviews"][0].id
    r = user_client.post(f"{API}/reviews/{rid}/comments", json={"body": "저도 비슷한 경험 있어요"})
    assert r.status_code == 201
    assert r.json()["is_mine"] is True

    lst = user_client.get(f"{API}/reviews/{rid}/comments").json()
    assert len(lst) == 1 and lst[0]["body"] == "저도 비슷한 경험 있어요"

    # 공개 리뷰 목록에도 댓글 수가 반영된다
    pub = user_client.get(f"{API}/stations/{world['station'].id}").json()
    hit = next(x for x in pub["reviews"]["items"] if x["id"] == rid)
    assert hit["comment_count"] == 1


def test_review_comment_one_level_reply_only(user_client, world):
    rid = world["reviews"][0].id
    top = user_client.post(f"{API}/reviews/{rid}/comments", json={"body": "원댓글"}).json()
    reply = user_client.post(f"{API}/reviews/{rid}/comments", json={"body": "대댓글", "parent_id": top["id"]})
    assert reply.status_code == 201

    tree = user_client.get(f"{API}/reviews/{rid}/comments").json()
    assert len(tree) == 1 and len(tree[0]["replies"]) == 1

    # 대댓글에는 또 답글을 달 수 없다
    reply_id = tree[0]["replies"][0]["id"]
    nested = user_client.post(f"{API}/reviews/{rid}/comments", json={"body": "대대댓글", "parent_id": reply_id})
    assert nested.status_code == 422


def test_review_comment_banned_word_rejected(user_client, world):
    rid = world["reviews"][0].id
    r = user_client.post(f"{API}/reviews/{rid}/comments", json={"body": "이 경찰관은 무능하다"})
    assert r.status_code == 422


def test_review_comment_delete_is_soft_and_author_or_admin_only(db, client, world):
    make_user(db, "a@example.com")
    make_user(db, "b@example.com")
    a = login(client, "a@example.com")
    rid = world["reviews"][0].id
    cid = a.post(f"{API}/reviews/{rid}/comments", json={"body": "지울 댓글"}).json()["id"]
    a.post(f"{API}/auth/logout")

    b = login(client, "b@example.com")
    assert b.delete(f"{API}/reviews/comments/{cid}").status_code == 403
    b.post(f"{API}/auth/logout")

    a = login(client, "a@example.com")
    assert a.delete(f"{API}/reviews/comments/{cid}").status_code == 204
    tree = a.get(f"{API}/reviews/{rid}/comments").json()
    assert tree[0]["is_removed"] is True and tree[0]["body"] == "삭제된 댓글입니다."
    assert tree[0]["removed_at"] is not None  # 삭제 시각은 남긴다(조용히 사라지지 않음)


def test_review_comment_vote_and_sort_top(user_client, world):
    rid = world["reviews"][0].id
    c1 = user_client.post(f"{API}/reviews/{rid}/comments", json={"body": "댓글1"}).json()["id"]
    c2 = user_client.post(f"{API}/reviews/{rid}/comments", json={"body": "댓글2"}).json()["id"]

    v = user_client.post(f"{API}/reviews/comments/{c2}/vote", json={"value": 1})
    assert v.status_code == 200 and v.json() == {"up": 1, "down": 0, "score": 1, "my_vote": 1}

    by_new = user_client.get(f"{API}/reviews/{rid}/comments").json()
    assert [c["id"] for c in by_new] == [c1, c2]  # 기본은 작성순

    by_top = user_client.get(f"{API}/reviews/{rid}/comments?sort=top").json()
    assert [c["id"] for c in by_top] == [c2, c1]  # 추천순이면 c2 가 먼저

    # 취소도 된다
    cancel = user_client.post(f"{API}/reviews/comments/{c2}/vote", json={"value": 0})
    assert cancel.json() == {"up": 0, "down": 0, "score": 0, "my_vote": 0}


def test_review_comment_vote_requires_login(client, world):
    rid = world["reviews"][0].id
    cid_resp = client.post(f"{API}/reviews/{rid}/comments", json={"body": "익명시도"})
    assert cid_resp.status_code == 401  # 애초에 댓글도 로그인 필요
    assert client.post(f"{API}/reviews/comments/1/vote", json={"value": 1}).status_code == 401


def test_review_vote_requires_login(client, world):
    assert client.post(f"{API}/reviews/{world['reviews'][0].id}/vote", json={"value": 1}).status_code == 401


def test_review_vote_toggle_and_switch(user_client, world):
    rid = world["reviews"][0].id
    up = user_client.post(f"{API}/reviews/{rid}/vote", json={"value": 1}).json()
    assert up == {"up": 1, "down": 0, "score": 1, "my_vote": 1}

    down = user_client.post(f"{API}/reviews/{rid}/vote", json={"value": -1}).json()
    assert down == {"up": 0, "down": 1, "score": -1, "my_vote": -1}

    cancel = user_client.post(f"{API}/reviews/{rid}/vote", json={"value": 0}).json()
    assert cancel == {"up": 0, "down": 0, "score": 0, "my_vote": 0}


def test_review_vote_reflected_on_public_listing(user_client, world):
    rid = world["reviews"][0].id
    user_client.post(f"{API}/reviews/{rid}/vote", json={"value": 1})
    pub = user_client.get(f"{API}/stations/{world['station'].id}").json()
    hit = next(x for x in pub["reviews"]["items"] if x["id"] == rid)
    assert hit["score"] == 1 and hit["my_vote"] == 1


# ---------- 게시판 ----------
def post_payload(**over):
    body = {"region_id": "seoul", "title": "동네 순찰 관련 문의", "body": "순찰 빈도가 궁금합니다."}
    body.update(over)
    return body


def test_post_requires_login_to_create(client):
    assert client.post(f"{API}/posts", json=post_payload()).status_code == 401


def test_post_create_is_immediately_public(user_client, client, world):
    r = user_client.post(f"{API}/posts", json=post_payload())
    assert r.status_code == 201
    pid = r.json()["id"]

    pub = client.get(f"{API}/posts/{pid}")  # 비로그인도 즉시 조회 가능(사전 검수 없음)
    assert pub.status_code == 200
    assert pub.json()["title"] == "동네 순찰 관련 문의"


def test_post_station_must_belong_to_region(user_client, world):
    r = user_client.post(f"{API}/posts", json=post_payload(station_id=world["station"].id))
    assert r.status_code == 201

    bad = user_client.post(f"{API}/posts", json=post_payload(region_id="seoul", station_id=999999))
    assert bad.status_code == 422


def test_post_banned_word_rejected(user_client, world):
    r = user_client.post(f"{API}/posts", json=post_payload(title="병신같은 경찰서", body="정상 내용"))
    assert r.status_code == 422


def test_post_list_filters_and_sort(user_client, world):
    user_client.post(f"{API}/posts", json=post_payload(title="글1"))
    p2 = user_client.post(f"{API}/posts", json=post_payload(title="글2")).json()["id"]
    user_client.post(f"{API}/reviews/{world['reviews'][0].id}/vote", json={"value": 1})  # 무관한 투표(영향 없음 확인용)
    user_client.post(f"{API}/posts/{p2}/vote", json={"value": 1})

    by_new = user_client.get(f"{API}/posts?region_id=seoul&sort=new").json()
    assert by_new["items"][0]["title"] == "글2"  # 최신 글이 먼저

    by_top = user_client.get(f"{API}/posts?region_id=seoul&sort=top").json()
    assert by_top["items"][0]["id"] == p2  # 추천 많은 글이 먼저


def test_post_default_category_is_chat(user_client, world):
    pid = user_client.post(f"{API}/posts", json=post_payload()).json()["id"]
    detail = user_client.get(f"{API}/posts/{pid}").json()
    assert detail["category"] == "chat" and detail["category_label"] == "잡담"


def test_post_category_filter(user_client, world):
    info_id = user_client.post(f"{API}/posts", json=post_payload(category="info", title="정보성 글")).json()["id"]
    user_client.post(f"{API}/posts", json=post_payload(category="question", title="질문성 글"))

    only_info = user_client.get(f"{API}/posts?region_id=seoul&category=info").json()
    assert [x["id"] for x in only_info["items"]] == [info_id]


def test_post_search_title_and_body(user_client, world):
    pid = user_client.post(f"{API}/posts", json=post_payload(title="순찰 빈도 질문", body="새벽 시간대 순찰이 궁금해요")).json()["id"]
    user_client.post(f"{API}/posts", json=post_payload(title="전혀 다른 제목", body="전혀 다른 내용"))

    by_title = user_client.get(f"{API}/posts?region_id=seoul&q=순찰").json()
    assert any(x["id"] == pid for x in by_title["items"])
    by_body = user_client.get(f"{API}/posts?region_id=seoul&q=새벽").json()
    assert any(x["id"] == pid for x in by_body["items"])
    no_match = user_client.get(f"{API}/posts?region_id=seoul&q=이런내용없음").json()
    assert no_match["items"] == []


def test_post_view_count_increments_only_via_dedicated_endpoint(user_client, client, world):
    pid = user_client.post(f"{API}/posts", json=post_payload()).json()["id"]
    assert client.get(f"{API}/posts/{pid}").json()["view_count"] == 0  # GET 상세 조회만으로는 안 늘어남

    assert client.post(f"{API}/posts/{pid}/view").status_code == 204
    assert client.get(f"{API}/posts/{pid}").json()["view_count"] == 1
    client.post(f"{API}/posts/{pid}/view")
    assert client.get(f"{API}/posts/{pid}").json()["view_count"] == 2


def test_post_view_unknown_post_is_silently_ignored(client):
    assert client.post(f"{API}/posts/9999/view").status_code == 204  # 조용히 무시(에러 아님)


def test_post_delete_author_or_admin_only(db, client, admin_client, world):
    make_user(db, "a@example.com")
    make_user(db, "b@example.com")
    a = login(client, "a@example.com")
    pid = a.post(f"{API}/posts", json=post_payload()).json()["id"]
    a.post(f"{API}/auth/logout")

    b = login(client, "b@example.com")
    assert b.delete(f"{API}/posts/{pid}").status_code == 403
    b.post(f"{API}/auth/logout")

    assert admin_client.delete(f"{API}/posts/{pid}").status_code == 204
    assert client.get(f"{API}/posts/{pid}").status_code == 404


def test_post_comment_and_vote(user_client, world):
    pid = user_client.post(f"{API}/posts", json=post_payload()).json()["id"]
    c = user_client.post(f"{API}/posts/{pid}/comments", json={"body": "저도 궁금했어요"})
    assert c.status_code == 201
    assert len(user_client.get(f"{API}/posts/{pid}/comments").json()) == 1

    v = user_client.post(f"{API}/posts/{pid}/vote", json={"value": 1}).json()
    assert v["score"] == 1
    detail = user_client.get(f"{API}/posts/{pid}").json()
    assert detail["score"] == 1 and detail["comment_count"] == 1


def test_post_comment_vote_and_sort_top(user_client, world):
    pid = user_client.post(f"{API}/posts", json=post_payload()).json()["id"]
    c1 = user_client.post(f"{API}/posts/{pid}/comments", json={"body": "댓글1"}).json()["id"]
    c2 = user_client.post(f"{API}/posts/{pid}/comments", json={"body": "댓글2"}).json()["id"]
    user_client.post(f"{API}/post-comments/{c2}/vote", json={"value": 1})

    by_top = user_client.get(f"{API}/posts/{pid}/comments?sort=top").json()
    assert [c["id"] for c in by_top] == [c2, c1]


def test_post_comment_delete_shows_removed_at(user_client, world):
    pid = user_client.post(f"{API}/posts", json=post_payload()).json()["id"]
    cid = user_client.post(f"{API}/posts/{pid}/comments", json={"body": "지울 댓글"}).json()["id"]
    assert user_client.delete(f"{API}/post-comments/{cid}").status_code == 204
    tree = user_client.get(f"{API}/posts/{pid}/comments").json()
    assert tree[0]["is_removed"] is True and tree[0]["removed_at"] is not None


def test_popular_posts_excludes_old_and_removed(user_client, world):
    pid = user_client.post(f"{API}/posts", json=post_payload(title="인기글 후보")).json()["id"]
    user_client.post(f"{API}/posts/{pid}/vote", json={"value": 1})
    popular = user_client.get(f"{API}/posts/popular?region_id=seoul").json()
    assert any(p["id"] == pid for p in popular)

    user_client.delete(f"{API}/posts/{pid}")
    popular_after = user_client.get(f"{API}/posts/popular?region_id=seoul").json()
    assert all(p["id"] != pid for p in popular_after)


def test_popular_posts_period_filter(db, user_client, world):
    from datetime import datetime, timedelta, timezone
    from app.models import Post

    pid = user_client.post(f"{API}/posts", json=post_payload(title="오래된 인기글")).json()["id"]
    user_client.post(f"{API}/posts/{pid}/vote", json={"value": 1})
    post = db.get(Post, pid)
    post.created_at = datetime.now(timezone.utc) - timedelta(days=10)
    db.commit()

    today = user_client.get(f"{API}/posts/popular?region_id=seoul&period=today").json()
    assert all(p["id"] != pid for p in today)
    all_time = user_client.get(f"{API}/posts/popular?region_id=seoul&period=all").json()
    assert any(p["id"] == pid for p in all_time)

    # 게시판 목록의 sort=top 에도 같은 기간 필터가 적용된다
    list_today = user_client.get(f"{API}/posts?region_id=seoul&sort=top&period=today").json()
    assert all(x["id"] != pid for x in list_today["items"])
    list_all = user_client.get(f"{API}/posts?region_id=seoul&sort=top&period=all").json()
    assert any(x["id"] == pid for x in list_all["items"])
