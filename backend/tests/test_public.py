API = "/api/v1"


def test_regions_and_region_detail(client, world):
    regions = client.get(f"{API}/regions").json()
    assert regions == [{
        "id": "seoul", "name": "서울", "full_name": "서울경찰청", "station_total": 31, "station_count": 2,
        "hq_address": None, "hq_website": None,
    }]
    detail = client.get(f"{API}/regions/seoul").json()
    names = {s["name"] for s in detail["stations"]}
    assert names == {"테스트경찰서", "테스트경찰서2"}
    st1 = next(s for s in detail["stations"] if s["name"] == "테스트경찰서")
    assert st1["department_count"] == 2 and st1["address"] is None and st1["website"] is None
    assert client.get(f"{API}/regions/nope").status_code == 404


def test_rating_aggregation_is_exact(client, world):
    st = client.get(f"{API}/stations/{world['station'].id}").json()
    # 평가 2건(3점, 4점): 항목별·종합 모두 평균 3.5
    assert st["rating"] == {"fair": 3.5, "proc": 3.5, "att": 3.5, "comm": 3.5, "speed": 3.5, "overall": 3.5, "count": 2}
    # 평가가 없는 경찰서는 점수 None, 건수 0
    st2 = client.get(f"{API}/stations/{world['station2'].id}").json()
    assert st2["rating"]["overall"] is None and st2["rating"]["count"] == 0


def test_partial_ratings_average_only_filled_fields(client, world, db):
    from app.models import ReviewStatus
    r = world["reviews"][0]
    r.fair, r.proc, r.att, r.comm, r.speed = 5, 1, None, None, None  # 종합 = (5+1)/2 = 3.0
    r2 = world["reviews"][1]
    r2.status = ReviewStatus.rejected  # 비공개는 집계 제외
    db.commit()
    s = client.get(f"{API}/stations/{world['station'].id}").json()["rating"]
    assert s["overall"] == 3.0 and s["att"] is None and s["count"] == 1


def test_public_review_never_exposes_case_number_or_author(client, world):
    text = client.get(f"{API}/stations/{world['station'].id}").text
    assert "case_number" not in text and "CASE-0" not in text and "author" not in text


def test_station_review_pagination(client, world):
    r = client.get(f"{API}/stations/{world['station'].id}", params={"size": 1, "page": 2}).json()
    assert r["reviews"]["total"] == 2 and len(r["reviews"]["items"]) == 1 and r["reviews"]["page"] == 2
    # 최신순: 7월(후기 1)이 1페이지, 5월(후기 0)이 2페이지
    assert r["reviews"]["items"][0]["body"] == "후기 0"


def test_unknown_station_is_404(client):
    assert client.get(f"{API}/stations/9999").status_code == 404


def test_search(client, world):
    r = client.get(f"{API}/search", params={"q": "테스트경찰서2"}).json()
    assert [s["name"] for s in r["stations"]] == ["테스트경찰서2"]
    # LIKE 와일드카드는 이스케이프되어 전체 매칭이 되지 않는다
    assert client.get(f"{API}/search", params={"q": "%"}).json() == {"query": "%", "stations": []}
    assert client.get(f"{API}/search", params={"q": ""}).status_code == 422
    assert client.get(f"{API}/search", params={"q": "   "}).status_code == 422


def test_recent_reviews_and_stats(client, world):
    recent = client.get(f"{API}/reviews/recent", params={"limit": 1}).json()
    assert len(recent) == 1 and recent[0]["body"] == "후기 1" and recent[0]["station_name"] == "테스트경찰서"
    stats = client.get(f"{API}/stats/overview").json()
    assert stats["totals"] == {"stations": 2, "departments": 2, "reviews": 2}
    assert stats["national"]["overall"] == 3.5
    assert [r["name"] for r in stats["station_ranking"]] == ["테스트경찰서"]  # 평가 없는 station2 는 순위에서 제외
    assert stats["appeal_acceptance_rate"] is None and stats["appeals_filed"] == []


def test_station_and_region_expose_address_and_website(client, db, world):
    from app.models import Region
    db.get(Region, "seoul").hq_address = "서울시 종로구 사직로8길 31"
    world["station"].address, world["station"].website = "테스트시 테스트구 1", "https://example.gov"
    db.commit()

    region = client.get(f"{API}/regions/seoul").json()
    assert region["hq_address"] == "서울시 종로구 사직로8길 31"
    station = client.get(f"{API}/stations/{world['station'].id}").json()
    assert station["address"] == "테스트시 테스트구 1" and station["website"] == "https://example.gov"
