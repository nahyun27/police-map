"""광고 노출·클릭·관리 + 광고·제휴 문의."""
from datetime import date, timedelta
from io import BytesIO

from PIL import Image

API = "/api/v1"


def png(w=1200, h=300) -> bytes:
    buf = BytesIO()
    Image.new("RGB", (w, h), (30, 60, 200)).save(buf, "PNG")
    return buf.getvalue()


def create_ad(admin_client, side=False, **form):
    data = {"title": "테스트 광고", "advertiser": "제주갈치", "link_url": "https://example.com/ad"}
    data.update({k: v for k, v in form.items() if v is not None})
    files = {"image_wide": ("wide.png", png(), "image/png")}
    if side:
        files["image_side"] = ("side.png", png(160, 600), "image/png")
    return admin_client.post(f"{API}/admin/ads", data=data, files=files)


def test_only_admin_can_create_ads(user_client, admin_client, world):
    assert create_ad(user_client).status_code == 403
    r = create_ad(admin_client, region_id="seoul")
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["region_name"] == "서울" and body["is_live"] is True and body["image_wide_url"].endswith(".webp")


def test_upload_rejects_non_image_and_bad_link(admin_client, world):
    r = admin_client.post(f"{API}/admin/ads", data={"title": "t", "advertiser": "a", "link_url": "https://e.com"},
                          files={"image_wide": ("x.png", b"not an image", "image/png")})
    assert r.status_code == 422
    assert create_ad(admin_client, link_url="javascript:alert(1)").status_code == 422


def test_uploaded_image_is_served(client, admin_client, world):
    url = create_ad(admin_client).json()["image_wide_url"]
    r = client.get(url)
    assert r.status_code == 200 and r.content[:4] == b"RIFF"  # WebP 로 다시 인코딩됨


def test_region_ads_first_then_national_and_impressions(client, admin_client, world):
    seoul = create_ad(admin_client, region_id="seoul", advertiser="서울 법률사무소").json()["id"]
    nat = create_ad(admin_client, advertiser="전국 광고주").json()["id"]
    got = client.get(f"{API}/ads?region_id=seoul&limit=2").json()
    assert [a["id"] for a in got] == [seoul, nat]
    # 경찰서 → 그 경찰서의 지역으로 풀린다
    assert client.get(f"{API}/ads?station_id={world['station'].id}&limit=1").json()[0]["id"] == seoul
    # 지역 없이 부르면 전국 광고만
    assert [a["id"] for a in client.get(f"{API}/ads").json()] == [nat]
    stats = {a["id"]: a for a in admin_client.get(f"{API}/admin/ads").json()}
    assert stats[seoul]["impressions"] == 2 and stats[nat]["impressions"] == 2


def test_side_slot_needs_side_image(client, admin_client, world):
    create_ad(admin_client)
    with_side = create_ad(admin_client, side=True).json()["id"]
    assert [a["id"] for a in client.get(f"{API}/ads?slot=side&limit=4").json()] == [with_side]


def test_inactive_or_expired_ads_hidden(client, admin_client, world):
    old = create_ad(admin_client, ends_on=str(date.today() - timedelta(days=1))).json()["id"]
    later = create_ad(admin_client, starts_on=str(date.today() + timedelta(days=3))).json()["id"]
    off = create_ad(admin_client).json()["id"]
    admin_client.patch(f"{API}/admin/ads/{off}", json={"is_active": False})
    shown = {a["id"] for a in client.get(f"{API}/ads?limit=4").json()}
    assert shown.isdisjoint({old, later, off})


def test_click_redirects_and_counts(client, admin_client, world):
    ad = create_ad(admin_client).json()["id"]
    r = client.get(f"{API}/ads/{ad}/click", follow_redirects=False)
    assert r.status_code == 302 and r.headers["location"] == "https://example.com/ad"
    assert next(a for a in admin_client.get(f"{API}/admin/ads").json() if a["id"] == ad)["clicks"] == 1


def test_delete_ad_removes_it(client, admin_client, world):
    ad = create_ad(admin_client).json()
    assert admin_client.delete(f"{API}/admin/ads/{ad['id']}").status_code == 204
    assert client.get(ad["image_wide_url"]).status_code == 404
    assert client.get(f"{API}/ads").json() == []


# ---------- 문의 ----------
def inquiry(**over):
    body = {"inquiry_type": "ad", "company": "제주갈치상회", "name": "홍길동", "contact": "010-0000-0000",
            "region_interest": "제주", "message": "제주 지역 광고를 하고 싶습니다. 단가를 알려주세요.", "agreed": True}
    body.update(over)
    return body


def test_inquiry_anonymous_then_admin_handles(client, admin_client, monkeypatch):
    sent = []
    monkeypatch.setattr("app.api.v1.ads.send_notification", lambda subject, body: sent.append(subject) or True)
    r = client.post(f"{API}/ad-inquiries", json=inquiry())
    assert r.status_code == 201
    assert sent and "제주갈치상회" in sent[0]  # 알림 메일 호출(실제 발송 여부는 SMTP 설정에 따름)
    assert client.post(f"{API}/ad-inquiries", json=inquiry(agreed=False)).status_code == 422

    assert client.get(f"{API}/admin/inquiries").status_code in (401, 403)
    lst = admin_client.get(f"{API}/admin/inquiries").json()
    assert lst["total"] == 1 and lst["items"][0]["contact"] == "010-0000-0000"
    qid = lst["items"][0]["id"]
    assert admin_client.post(f"{API}/admin/inquiries/{qid}/done", json={"note": "단가표 회신함"}).status_code == 204
    assert admin_client.get(f"{API}/admin/inquiries").json()["total"] == 0
    assert admin_client.get(f"{API}/admin/inquiries?status=done").json()["items"][0]["admin_note"] == "단가표 회신함"


def test_mail_skipped_when_not_configured():
    from app.services.mailer import send_notification
    assert send_notification("s", "b") is False
