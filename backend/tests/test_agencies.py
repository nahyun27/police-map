"""시·도경찰청과 경찰청 본청·국가수사본부를 평가 대상으로 들여오기(scripts/import_stations.py)와 공개 API 표시."""
from app.models import Region, Station
from scripts.import_stations import import_data

API = "/api/v1"


def _payload():
    def item(region, typ, name, depts):
        return {"region": region, "type": typ, "name": name, "address": "주소", "website": "https://x.go.kr", "departments": depts}
    return {
        "meta": {"source": "전국경찰관서안내"},
        "stations": [
            item("본청", "경찰청", "경찰청(본청)", ["감사관"]) | {"dept_source": "경찰청 조직구성도"},
            item("본청", "국가수사본부", "국가수사본부", ["수사국"]),
            item("서울", "시도경찰청", "서울특별시경찰청", ["광역수사단", "반부패경제범죄수사대"]),
            item("서울", "경찰서", "서울가나경찰서", ["수사과"]),
        ],
    }


def test_import_agencies_as_stations(db, client):
    db.add(Region(id="seoul", name="서울", full_name="서울경찰청"))
    db.commit()
    import_data(db, _payload())
    db.commit()
    kinds = {s.name: s.kind for s in db.query(Station).all()}
    assert kinds == {"경찰청(본청)": "national", "국가수사본부": "national", "서울특별시경찰청": "provincial", "서울가나경찰서": "station"}
    assert db.get(Region, "national").name == "본청"
    assert db.get(Region, "seoul").station_total == 1  # 관할 경찰서 수에는 시·도경찰청을 세지 않는다
    assert db.query(Station).filter_by(name="경찰청(본청)").one().source == "경찰청 조직구성도"

    # 지역 목록·상세: 경찰서 수는 경찰서만, 상세 목록은 시·도경찰청이 맨 위
    regions = {r["id"]: r for r in client.get(f"{API}/regions").json()}
    assert regions["seoul"]["station_count"] == 1 and regions["national"]["station_count"] == 0
    seoul = client.get(f"{API}/regions/seoul").json()
    assert [s["kind"] for s in seoul["stations"]] == ["provincial", "station"]

    # "서울청", "국수본"처럼 사람들이 실제로 치는 말로도 검색된다.
    assert [s["name"] for s in client.get(f"{API}/search", params={"q": "서울청"}).json()["stations"]] == ["서울특별시경찰청"]
    assert client.get(f"{API}/search", params={"q": "국수본"}).json()["stations"][0]["kind"] == "national"

    # 다시 넣어도 중복 생성되지 않는다(멱등).
    import_data(db, _payload())
    db.commit()
    assert db.query(Station).count() == 4


def test_agency_page_and_review(db, client):
    db.add(Region(id="seoul", name="서울", full_name="서울경찰청"))
    db.commit()
    import_data(db, _payload())
    db.commit()
    sid = db.query(Station).filter_by(name="서울특별시경찰청").one().id
    detail = client.get(f"{API}/stations/{sid}").json()
    assert detail["kind"] == "provincial" and detail["departments"] == ["광역수사단", "반부패경제범죄수사대"] and detail["nearby"] == []
    body = {"station_id": sid, "role": "complainant", "case_type": "fraud", "ratings": {"fair": 4}, "body": "광역수사단 수사 경험"}
    assert client.post(f"{API}/reviews", json=body).status_code == 201
