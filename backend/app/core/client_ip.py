"""요청자의 실제 IP. 비로그인 1인 1표·공감, 요청 횟수 제한, 방문 통계가 모두 이 값을 쓴다.

policemap.kr 은 Cloudflare 를 거쳐 들어와서 서버가 보는 접속 주소(request.client.host)가 Cloudflare 서버 주소다.
그대로 쓰면 서로 다른 이용자가 같은 사람으로 묶인다. Cloudflare 는 원래 IP 를 CF-Connecting-IP 헤더로 알려 주지만
이 헤더는 누구나 꾸며 보낼 수 있으므로, 접속 주소가 실제 Cloudflare 대역일 때만 믿는다(직접 접속에서 보낸 값은 무시).
대역 출처: https://www.cloudflare.com/ips/ (바뀌면 갱신)."""
import ipaddress

from fastapi import Request

_CLOUDFLARE_NETS = [ipaddress.ip_network(n) for n in (
    "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18",
    "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
    "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
    "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
)]


def _is_cloudflare(host: str) -> bool:
    try:
        ip = ipaddress.ip_address(host)
    except ValueError:
        return False
    return any(ip in net for net in _CLOUDFLARE_NETS)


def real_client_ip(request: Request) -> str:
    host = request.client.host if request.client else "unknown"
    if _is_cloudflare(host):
        forwarded = (request.headers.get("cf-connecting-ip") or "").strip()
        try:
            return str(ipaddress.ip_address(forwarded))
        except ValueError:
            pass
    return host
