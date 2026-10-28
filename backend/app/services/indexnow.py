"""IndexNow: 새 글이 생기면 검색엔진(네이버·빙 등)에 주소를 바로 알린다. 네이버 수집 로봇이 새 사이트에 드물게 와서
(2026-10 기준 구글 대비 1/70) 기다리지 않고 알리기 위해 붙였다. 키 확인 파일은 프런트의 public/<키>.txt 다.

알림 실패가 글 작성을 막으면 안 되므로 BackgroundTasks 로 부르고, 실패는 로그만 남긴다.
개발·테스트 환경에서는 아무것도 보내지 않는다.
"""
import json
import logging
import urllib.request
from urllib.parse import urlsplit

from app.core.config import settings

logger = logging.getLogger(__name__)

# 네이버는 자체 수신 주소, 빙 등은 indexnow.org 공용 주소로 받는다(참여 검색엔진끼리 공유).
ENDPOINTS = ("https://searchadvisor.naver.com/indexnow", "https://api.indexnow.org/indexnow")
MAX_URLS = 10000  # 한 번에 보낼 수 있는 최대 개수


def enabled() -> bool:
    env = settings.ENVIRONMENT.strip().lower()
    return bool(settings.INDEXNOW_KEY) and env not in ("development", "dev", "test", "local")


def site_url(path: str) -> str:
    return settings.PUBLIC_SITE_URL.rstrip("/") + path


def submit(urls: list[str]) -> dict[str, int | str]:
    """주소 목록을 알린다. 검색엔진별 응답 코드(200/202 면 접수)를 돌려준다."""
    if not enabled() or not urls:
        return {}
    host = urlsplit(settings.PUBLIC_SITE_URL).hostname
    payload = json.dumps({
        "host": host, "key": settings.INDEXNOW_KEY,
        "keyLocation": site_url(f"/{settings.INDEXNOW_KEY}.txt"), "urlList": urls[:MAX_URLS],
    }).encode()
    results: dict[str, int | str] = {}
    for endpoint in ENDPOINTS:
        req = urllib.request.Request(endpoint, data=payload, method="POST",
                                     headers={"Content-Type": "application/json; charset=utf-8"})
        try:
            with urllib.request.urlopen(req, timeout=15) as res:
                results[endpoint] = res.status
        except urllib.error.HTTPError as e:
            results[endpoint] = e.code
            logger.warning("IndexNow %s 응답 %s", endpoint, e.code)
        except Exception as e:  # 네트워크 오류 등. 글 작성에는 영향 없음.
            results[endpoint] = repr(e)
            logger.warning("IndexNow %s 실패: %r", endpoint, e)
    return results
