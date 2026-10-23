"""실제 IP 판별(core/client_ip.py): Cloudflare 가 알려 주는 원래 IP 는 실제 Cloudflare 에서 온 요청일 때만 믿는다."""
from starlette.requests import Request

from app.core.client_ip import real_client_ip


def _req(host: str, cf_ip: str | None = None) -> Request:
    headers = [(b"cf-connecting-ip", cf_ip.encode())] if cf_ip else []
    return Request({"type": "http", "client": (host, 1234), "headers": headers})


def test_cloudflare_header_trusted_only_from_cloudflare():
    assert real_client_ip(_req("172.71.111.52", "211.36.1.2")) == "211.36.1.2"  # Cloudflare 대역 → 원래 IP
    assert real_client_ip(_req("13.125.0.9", "1.1.1.1")) == "13.125.0.9"  # 직접 접속에서 꾸민 헤더는 무시
    assert real_client_ip(_req("172.71.111.52", "not-an-ip")) == "172.71.111.52"  # 이상한 값이면 접속 주소
    assert real_client_ip(_req("2606:4700::1", "2001:db8::5")) == "2001:db8::5"
