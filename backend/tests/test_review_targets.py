"""경찰서·부서·수사관 단위 평가(2026-10 의뢰인 결정). 수사관 이름은 이용자가 입력하면 DB 에 등록되고
공개 화면에는 일부 가린 이름(김*수)만 나간다."""
from conftest import review_payload

from app.models import Department, Officer
from app.services.names import mask_name

API = "/api/v1"


def test_mask_name():
    assert mask_name("김철수") == "김*수"
    assert mask_name("이준") == "이*"
    assert mask_name("남궁민수") == "남**수"


def test_targets_endpoint_lists_departments(client, world):
    t = client.get(f"{API}/stations/{world['station'].id}/targets").json()
    assert {d["label"] for d in t["departments"]} == {"수사과", "사이버수사팀"}
    # world 픽스처의 공고 출처 수사관(가상갑)도 가린 이름으로만 나온다
    assert [o["label"] for o in t["officers"]] == ["가*갑"] and "가상갑" not in str(t)


def test_department_review(client, db, world):
    dept = db.query(Department).filter_by(station_id=world["station"].id, name="수사과").one()
    r = client.post(f"{API}/reviews", json=review_payload(world["station"].id, department_id=dept.id))
    assert r.status_code == 201
    st = client.get(f"{API}/stations/{world['station'].id}").json()
    item = next(x for x in st["reviews"]["items"] if x["id"] == r.json()["id"])
    assert item["target_type"] == "department" and item["target_label"] == "수사과"
    assert any(d["label"] == "수사과" and d["rating"]["count"] == 1 for d in st["department_ratings"])
    filtered = client.get(f"{API}/stations/{world['station'].id}?department_id={dept.id}").json()
    assert filtered["reviews"]["total"] == 1 and filtered["filter_label"] == "수사과"


def test_new_officer_name_is_registered_and_masked(client, db, world):
    sid = world["station"].id
    dept = db.query(Department).filter_by(station_id=sid, name="수사과").one()
    r = client.post(f"{API}/reviews", json=review_payload(
        sid, department_id=dept.id, officer_name="김철수", officer_rank="경위",
        body="김철수 경위가 절차를 친절하게 설명해 주었습니다.",
    ))
    assert r.status_code == 201
    o = db.query(Officer).filter_by(station_id=sid, name="김철수").one()  # 실명은 DB 에 그대로
    assert o.source.value == "user_report" and o.department_id == dept.id

    st = client.get(f"{API}/stations/{sid}").json()
    item = next(x for x in st["reviews"]["items"] if x["id"] == r.json()["id"])
    assert item["target_label"] == "김*수 경위 · 수사과"
    assert "김철수" not in item["body"] and "김*수" in item["body"]  # 본문 실명도 가림
    assert "김철수" not in str(st)  # 공개 응답 어디에도 실명이 없다
    assert any(o2["label"] == "김*수" for o2 in st["officer_ratings"])

    # 같은 경찰서에 같은 이름을 다시 입력하면 새로 만들지 않고 같은 사람으로 묶인다
    client.post(f"{API}/reviews", json=review_payload(sid, officer_name="김철수", case_number=None))
    assert db.query(Officer).filter_by(station_id=sid, name="김철수").count() == 1
    targets = client.get(f"{API}/stations/{sid}/targets").json()
    assert any(x["label"] == "김*수" and x["rank"] == "경위" for x in targets["officers"])
    assert "김철수" not in str(targets)


def test_pick_existing_officer_and_filter(client, db, world):
    sid = world["station"].id
    client.post(f"{API}/reviews", json=review_payload(sid, officer_name="박영희"))
    oid = db.query(Officer).filter_by(name="박영희").one().id
    r = client.post(f"{API}/reviews", json=review_payload(sid, officer_id=oid, case_number=None))
    assert r.status_code == 201
    f = client.get(f"{API}/stations/{sid}?officer_id={oid}").json()
    assert f["reviews"]["total"] == 2 and f["filter_label"] == "박*희"


def test_officer_must_belong_to_station(client, db, world):
    client.post(f"{API}/reviews", json=review_payload(world["station"].id, officer_name="이민호"))
    oid = db.query(Officer).filter_by(name="이민호").one().id
    r = client.post(f"{API}/reviews", json=review_payload(world["station2"].id, officer_id=oid, case_number=None))
    assert r.status_code == 404
    dept = db.query(Department).filter_by(station_id=world["station"].id).first()
    r = client.post(f"{API}/reviews", json=review_payload(world["station2"].id, department_id=dept.id, case_number=None))
    assert r.status_code == 404


def test_invalid_officer_name_rejected(client, world):
    for bad in ["a", "김", "김철수123", "가나다라마바"]:
        assert client.post(f"{API}/reviews", json=review_payload(world["station"].id, officer_name=bad)).status_code == 422


def test_blinded_officer_hidden_and_not_selectable(client, db, world):
    sid = world["station"].id
    rid = client.post(f"{API}/reviews", json=review_payload(sid, officer_name="최지훈")).json()["id"]
    o = db.query(Officer).filter_by(name="최지훈").one()
    # 당사자 삭제·정정 요청 → 수사관 정보 임시조치
    r = client.post(f"{API}/takedown-requests", json={
        "target_type": "officer", "target_id": o.id, "request_type": "delete", "requester_name": "최지훈",
        "requester_contact": "c@example.com", "relation": "본인", "reason": "본인 동의 없이 이름이 게시되었습니다.",
    })
    assert r.status_code == 201
    st = client.get(f"{API}/stations/{sid}").json()
    item = next(x for x in st["reviews"]["items"] if x["id"] == rid)
    assert item["target_label"] == "비공개 처리된 수사관"
    assert all(x["id"] != o.id for x in st["officer_ratings"])
    assert all(x["id"] != o.id for x in client.get(f"{API}/stations/{sid}/targets").json()["officers"])
    assert client.post(f"{API}/reviews", json=review_payload(sid, officer_name="최지훈", case_number=None)).status_code == 422
