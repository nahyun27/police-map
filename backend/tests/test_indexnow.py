"""IndexNow 알림: 운영 환경에서만, 게시된 평가·게시글 주소를 보낸다."""
from app.core.config import settings
from app.services import indexnow
from conftest import review_payload

API = "/api/v1"


def test_indexnow_disabled_outside_production(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "test")
    assert indexnow.enabled() is False
    assert indexnow.submit(["https://policemap.co.kr/"]) == {}


def test_new_review_and_post_are_announced(client, world, monkeypatch):
    sent = []
    monkeypatch.setattr(indexnow, "submit", lambda urls: sent.extend(urls))
    assert client.post(f"{API}/reviews", json=review_payload(world["station"].id, case_number="2026-형제-77777")).status_code == 201
    r = client.post(f"{API}/posts", json={"title": "테스트 게시글입니다", "body": "본문 내용"})
    assert r.status_code == 201
    assert sent == [
        f"{settings.PUBLIC_SITE_URL}/station/{world['station'].id}",
        f"{settings.PUBLIC_SITE_URL}/board/{r.json()['id']}",
    ]
