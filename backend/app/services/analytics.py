"""방문 통계 수집·집계(models/analytics.py). 쿠키 없이 "그날의 방문자"만 센다."""
import hashlib
import hmac
import re
from datetime import date, datetime, timedelta
from urllib.parse import urlsplit
from zoneinfo import ZoneInfo

from fastapi import Request

from app.core.client_ip import real_client_ip
from app.core.config import settings

KST = ZoneInfo("Asia/Seoul")
# 검색 로봇·미리보기 봇·자동화 도구는 방문자로 세지 않는다.
_BOT = re.compile(r"bot|crawl|spider|slurp|preview|headless|lighthouse|python|curl|wget|facebookexternalhit|yeti|daum", re.I)
_OWN_HOSTS = ("policemap.co.kr", "policemap.kr", "localhost")


def today_kst() -> date:
    return datetime.now(KST).date()


def is_bot(user_agent: str) -> bool:
    return not user_agent or bool(_BOT.search(user_agent))


def client_ip(request: Request) -> str:
    # Cloudflare 경유(policemap.kr)면 원래 IP. 헤더는 실제 Cloudflare 에서 온 요청일 때만 믿는다(core/client_ip.py).
    return real_client_ip(request)


def visitor_hash(day: date, ip: str, user_agent: str) -> str:
    """날짜·IP·브라우저로 만든 해시. 날짜가 섞여 있어 다음 날이면 같은 사람도 다른 값이 된다."""
    msg = f"visit:{day.isoformat()}|{ip}|{user_agent}".encode()
    return hmac.new(settings.JWT_SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()[:32]


def clean_path(path: str) -> str | None:
    if not path.startswith("/") or path.startswith("//") or path.startswith("/admin") or path.startswith("/api/"):
        return None
    return path.split("?", 1)[0].split("#", 1)[0][:300] or "/"


def referrer_host(referrer: str | None) -> str | None:
    if not referrer:
        return None
    try:
        host = (urlsplit(referrer).hostname or "").lower()
    except ValueError:
        return None
    if not host or any(host == h or host.endswith("." + h) for h in _OWN_HOSTS):
        return None
    return host[:120]


def last_days(n: int) -> list[date]:
    end = today_kst()
    return [end - timedelta(days=i) for i in range(n - 1, -1, -1)]
