API = "/api/v1"


def test_regions_and_region_detail(client, world):
    regions = client.get(f"{API}/regions").json()
    assert regions == [{"id": "seoul", "name": "서울", "full_name": "서울경찰청", "station_total": 31, "station_count": 1}]
    detail = client.get(f"{API}/regions/seoul").json()
    assert detail["stations"][0]["name"] == "테스트경찰서"
    assert detail["stations"][0]["department_count"] == 2
    assert client.get(f"{API}/regions/nope").status_code == 404


def test_rating_aggregation_is_exact(client, world):
    o = client.get(f"{API}/officers/{world['a'].id}").json()
    # 평가 2건(3점, 4점): 항목별·종합 모두 평균 3.5
    assert o["rating"] == {"fair": 3.5, "proc": 3.5, "att": 3.5, "comm": 3.5, "speed": 3.5, "overall": 3.5, "count": 2}
    st = client.get(f"{API}/stations/{world['station'].id}").json()
    assert st["rating"]["overall"] == 3.5 and st["rating"]["count"] == 2
    # 평가가 없는 수사관은 점수 None, 건수 0
    b = next(x for x in st["officers"] if x["name"] == "가상을")
    assert b["rating"]["overall"] is None and b["rating"]["count"] == 0


def test_partial_ratings_average_only_filled_fields(client, world, db):
    from app.models import ReviewStatus
    r = world["reviews"][0]
    r.fair, r.proc, r.att, r.comm, r.speed = 5, 1, None, None, None  # 종합 = (5+1)/2 = 3.0
    r2 = world["reviews"][1]
    r2.status = ReviewStatus.rejected  # 비공개는 집계 제외
    db.commit()
    s = client.get(f"{API}/officers/{world['a'].id}").json()["rating"]
    assert s["overall"] == 3.0 and s["att"] is None and s["count"] == 1


def test_public_review_never_exposes_case_number_or_author(client, world):
    text = client.get(f"{API}/officers/{world['a'].id}").text
    assert "case_number" not in text and "CASE-0" not in text and "author" not in text and "seed@" not in text


def test_officer_pagination(client, world):
    r = client.get(f"{API}/officers/{world['a'].id}", params={"size": 1, "page": 2}).json()
    assert r["reviews"]["total"] == 2 and len(r["reviews"]["items"]) == 1 and r["reviews"]["page"] == 2
    # 최신순: 7월(후기 1)이 1페이지, 5월(후기 0)이 2페이지
    assert r["reviews"]["items"][0]["body"] == "후기 0"


def test_hidden_officers_are_404_and_excluded(client, world, db):
    world["b"].is_published = False
    world["a"].is_blinded = True
    db.commit()
    assert client.get(f"{API}/officers/{world['a'].id}").status_code == 404
    assert client.get(f"{API}/officers/{world['b'].id}").status_code == 404
    st = client.get(f"{API}/stations/{world['station'].id}").json()
    assert st["officers"] == []
    # 임시조치 중인 수사관의 평가는 관서 평점에도 반영되지 않는다
    assert st["rating"]["count"] == 0
    assert client.get(f"{API}/search", params={"q": "가상"}).json()["officers"] == []


def test_search(client, world):
    r = client.get(f"{API}/search", params={"q": "테스트"}).json()
    assert [s["name"] for s in r["stations"]] == ["테스트경찰서"]
    r = client.get(f"{API}/search", params={"q": "사이버"}).json()  # 부서명으로도 검색
    assert [o["name"] for o in r["officers"]] == ["가상을"]
    assert r["officers"][0]["station_name"] == "테스트경찰서"
    # LIKE 와일드카드는 이스케이프되어 전체 매칭이 되지 않는다
    assert client.get(f"{API}/search", params={"q": "%"}).json() == {"query": "%", "stations": [], "officers": []}
    assert client.get(f"{API}/search", params={"q": ""}).status_code == 422
    assert client.get(f"{API}/search", params={"q": "   "}).status_code == 422


def test_recent_reviews_and_stats(client, world):
    recent = client.get(f"{API}/reviews/recent", params={"limit": 1}).json()
    assert len(recent) == 1 and recent[0]["body"] == "후기 1" and recent[0]["station_name"] == "테스트경찰서"
    stats = client.get(f"{API}/stats/overview").json()
    assert stats["totals"] == {"stations": 1, "departments": 2, "officers": 2, "reviews": 2}
    assert stats["national"]["overall"] == 3.5
    assert [r["name"] for r in stats["station_ranking"]] == ["테스트경찰서"]
    assert stats["appeal_acceptance_rate"] is None and stats["appeals_filed"] == []
