"""자체 방문 통계: 수집 규칙(봇·관리자 페이지 제외, 쿼리스트링 제거, 원래 IP 미저장)과 관리자 집계."""
from app.models import PageView

API = "/api/v1"
BROWSER = {"User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148 Safari/604.1"}


def test_track_stores_minimal_data(db, client):
    r = client.post(f"{API}/track", json={"path": "/search?q=김철수", "referrer": "https://search.naver.com/x?q=y"}, headers=BROWSER)
    assert r.status_code == 204
    pv = db.query(PageView).one()
    assert pv.path == "/search" and pv.referrer_host == "search.naver.com" and pv.device == "mobile"
    assert len(pv.visitor_hash) == 32 and "testclient" not in pv.visitor_hash


def test_bots_admin_and_internal_referrers_not_counted(db, client):
    client.post(f"{API}/track", json={"path": "/"}, headers={"User-Agent": "Googlebot/2.1"})
    client.post(f"{API}/track", json={"path": "/admin/users"}, headers=BROWSER)
    client.post(f"{API}/track", json={"path": "https://evil.example/"}, headers=BROWSER)
    client.post(f"{API}/track", json={"path": "/board", "referrer": "https://policemap.kr/"}, headers=BROWSER)
    rows = db.query(PageView).all()
    assert [(r.path, r.referrer_host) for r in rows] == [("/board", None)]


def test_traffic_stats(client, admin_client, user_client):
    for path in ("/", "/board", "/board"):
        client.post(f"{API}/track", json={"path": path}, headers=BROWSER)
    assert user_client.get(f"{API}/admin/stats/traffic").status_code == 403
    t = admin_client.get(f"{API}/admin/stats/traffic").json()
    assert t["today"] == {"visitors": 1, "pageviews": 3}  # 같은 브라우저·IP 는 하루 1명
    assert t["top_pages"][0] == ["/board", 2] and len(t["daily"]) == 14 and t["mobile_ratio"] == 1.0
