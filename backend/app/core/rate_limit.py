"""프로세스 메모리 기반 단순 속도 제한.

단일 인스턴스 전제다. 서버를 여러 대로 늘리면 Redis 등 공유 저장소로 바꿔야 한다.
Nginx 뒤에서는 request.client.host 가 프록시 주소가 되므로, 배포 시 uvicorn 의
--proxy-headers / --forwarded-allow-ips 설정으로 실제 클라이언트 IP 를 받도록 해야 한다.
"""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status
from app.core.client_ip import real_client_ip


def _client_key(request: Request) -> str:
    """로그인한 요청은 계정 단위, 아니면 IP 단위로 센다. 국내 이동통신망은 많은 사용자가 IP 하나를
    공유(CGNAT)해서, 로그인한 사람까지 IP 로 묶으면 남의 사용량 때문에 막히는 일이 생긴다.
    (DB 조회 없이 토큰 서명·만료만 확인한다 — 위조 토큰은 decode 에서 걸러지고 IP 로 센다.)"""
    from app.core.cookies import get_access_token  # 순환 import 회피
    from app.core.security import decode_token
    token = get_access_token(request)
    if token:
        try:
            return f"u:{decode_token(token, expected_type='access')['sub']}"
        except Exception:
            pass
    return f"ip:{real_client_ip(request)}"


class RateLimiter:
    def __init__(self, max_calls: int, window_seconds: int, name: str):
        self.max_calls = max_calls
        self.window = window_seconds
        self.name = name
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._calls = 0

    def __call__(self, request: Request) -> None:
        key = _client_key(request)
        now = time.monotonic()
        q = self._hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.max_calls:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.")
        q.append(now)
        self._calls += 1
        if self._calls % 500 == 0:
            self._evict(now)

    def _evict(self, now: float) -> None:
        """오래 쓰지 않은 키를 지워 메모리가 계속 늘지 않게 한다."""
        for k in [k for k, q in self._hits.items() if not q or now - q[-1] > self.window]:
            del self._hits[k]

    def reset(self) -> None:
        self._hits.clear()


login_limiter = RateLimiter(10, 60, "login")
register_limiter = RateLimiter(20, 3600, "register")  # CGNAT 로 IP 를 공유하는 사용자를 고려해 넉넉히
takedown_limiter = RateLimiter(5, 3600, "takedown")
review_limiter = RateLimiter(20, 3600, "review")
post_limiter = RateLimiter(10, 3600, "post")
comment_limiter = RateLimiter(30, 3600, "comment")
vote_limiter = RateLimiter(60, 3600, "vote")
verify_limiter = RateLimiter(3, 86400, "officer_verify")
reply_limiter = RateLimiter(20, 3600, "reply")
report_limiter = RateLimiter(20, 3600, "report")
view_limiter = RateLimiter(120, 3600, "view")
delete_account_limiter = RateLimiter(5, 3600, "delete_account")
case_limiter = RateLimiter(5, 86400, "public_case")  # 사건 공론화 등록: 하루 5건
ad_limiter = RateLimiter(600, 3600, "ads")
scrap_limiter = RateLimiter(120, 3600, "scrap")  # 스크랩·관심지역·공감 토글은 투표와 따로 센다
follow_limiter = RateLimiter(60, 3600, "follow")
empathy_limiter = RateLimiter(120, 3600, "empathy")
ad_click_limiter = RateLimiter(60, 3600, "ad_click")  # 클릭 수 부풀리기 방지
track_limiter = RateLimiter(600, 3600, "track")  # 방문 기록: 페이지 이동마다 1회
inquiry_limiter = RateLimiter(5, 3600, "inquiry")  # 광고 문의는 삭제·정정 요청 한도와 따로
refresh_limiter = RateLimiter(120, 3600, "refresh")  # 광고 조회(페이지마다 1~2회) — 조회수 제한과 분리
ALL_LIMITERS = [
    login_limiter, register_limiter, takedown_limiter, review_limiter, post_limiter, comment_limiter, vote_limiter,
    verify_limiter, reply_limiter, report_limiter, view_limiter, delete_account_limiter, case_limiter,
    ad_limiter, ad_click_limiter, track_limiter, scrap_limiter, follow_limiter, empathy_limiter, inquiry_limiter, refresh_limiter,
]
