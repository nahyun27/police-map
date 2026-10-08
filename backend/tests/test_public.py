from conftest import pending_review, takedown_payload

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


def test_station_case_type_breakdown(client, user_client, world):
    """세계 fixture 의 평가 2건은 전부 case_type=fraud — 다른 유형 평가를 하나 더 추가해서
    경찰서 전체 평균 하나로 뭉뚱그려지지 않고 유형별로 쪼개지는지 확인한다."""
    from conftest import review_payload

    sid = world["station"].id
    user_client.post(f"{API}/reviews", json=review_payload(
        sid, case_type="assault", case_number="2027-폭행-001", ratings={"fair": 2, "proc": 2},
    ))
    by_type = {c["case_type"]: c for c in client.get(f"{API}/stations/{sid}").json()["by_case_type"]}
    assert by_type["fraud"]["rating"]["count"] == 2
    assert by_type["assault"]["rating"]["count"] == 1 and by_type["assault"]["case_type_label"] == "폭행·상해"


def test_nearby_stations_sorted_by_distance(client, db, world):
    from app.models import Station

    world["station"].lat, world["station"].lng = 37.5, 127.0  # 기준
    world["station2"].lat, world["station2"].lng = 37.51, 127.0  # 더 가까움(약 1.1km)
    world["station2"].is_sample = False  # 샘플 경찰서는 '인근 경찰서' 후보에서 빠지므로(세계 fixture 기본값) 끈다
    far = Station(region_id="seoul", name="먼경찰서", lat=38.5, lng=128.0)  # 훨씬 멂
    sample = Station(region_id="seoul", name="샘플경찰서", lat=37.501, lng=127.0, is_sample=True)  # 샘플은 제외
    db.add_all([far, sample])
    db.commit()

    nearby = client.get(f"{API}/stations/{world['station'].id}").json()["nearby"]
    assert [n["name"] for n in nearby] == ["테스트경찰서2", "먼경찰서"]
    assert nearby[0]["distance_km"] < nearby[1]["distance_km"]


def test_nearby_empty_without_coordinates(client, world):
    assert client.get(f"{API}/stations/{world['station'].id}").json()["nearby"] == []


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


def test_transparency_report_aggregates_current_quarter(db, client, user_client, admin_client, world):
    """운영원칙에 적힌 "분기별 투명성 보고서" 약속을 실제로 채우는지 확인 — 평가 반려/삭제,
    신고 처리, 삭제요청 처리가 전부 현재 분기 집계에 반영되는지 본다."""
    from datetime import datetime, timezone

    rid1 = pending_review(db, world["station"].id).id
    admin_client.post(f"{API}/admin/reviews/{rid1}/reject", json={"reason": "사유가 충분히 긴 반려 사유"})

    rid2 = world["reviews"][0].id
    admin_client.post(f"{API}/admin/reviews/{rid2}/remove", json={"reason": "사후 삭제 사유가 충분히 긺"})

    rid3 = world["reviews"][1].id
    report_id = user_client.post(
        f"{API}/reports", json={"target_type": "review", "target_id": rid3, "reason": "허위사실 같습니다"},
    ).json()["id"]
    admin_client.post(f"{API}/admin/reports/{report_id}/resolve", json={"action": "dismiss", "note": "확인 결과 문제 없음"})

    client.post(f"{API}/takedown-requests", json=takedown_payload(target_id=rid3))
    tid = admin_client.get(f"{API}/admin/takedown-requests").json()["items"][0]["id"]
    admin_client.post(f"{API}/admin/takedown-requests/{tid}/resolve", json={"decision": "keep", "note": "확인 결과 게시 유지"})

    report = client.get(f"{API}/stats/transparency").json()
    now = datetime.now(timezone.utc)
    q = (now.month - 1) // 3 + 1
    cur = next(x for x in report["quarters"] if x["year"] == now.year and x["quarter"] == q)
    assert cur["reviews_rejected"] >= 1
    assert cur["reviews_removed"] >= 1
    assert cur["reports_resolved_dismiss"] >= 1
    assert cur["takedowns_kept"] >= 1
