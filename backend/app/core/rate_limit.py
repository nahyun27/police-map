"""프로세스 메모리 기반 단순 속도 제한.

단일 인스턴스 전제다. 서버를 여러 대로 늘리면 Redis 등 공유 저장소로 바꿔야 한다.
Nginx 뒤에서는 request.client.host 가 프록시 주소가 되므로, 배포 시 uvicorn 의
--proxy-headers / --forwarded-allow-ips 설정으로 실제 클라이언트 IP 를 받도록 해야 한다.
"""
import time
from collections import defaultdict, deque

from fastapi import HTTPException, Request, status


class RateLimiter:
    def __init__(self, max_calls: int, window_seconds: int, name: str):
        self.max_calls = max_calls
        self.window = window_seconds
        self.name = name
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def __call__(self, request: Request) -> None:
        key = request.client.host if request.client else "unknown"
        now = time.monotonic()
        q = self._hits[key]
        while q and now - q[0] > self.window:
            q.popleft()
        if len(q) >= self.max_calls:
            raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.")
        q.append(now)

    def reset(self) -> None:
        self._hits.clear()


login_limiter = RateLimiter(10, 60, "login")
register_limiter = RateLimiter(5, 3600, "register")
takedown_limiter = RateLimiter(5, 3600, "takedown")
review_limiter = RateLimiter(10, 3600, "review")
post_limiter = RateLimiter(10, 3600, "post")
comment_limiter = RateLimiter(30, 3600, "comment")
vote_limiter = RateLimiter(60, 3600, "vote")
ALL_LIMITERS = [login_limiter, register_limiter, takedown_limiter, review_limiter, post_limiter, comment_limiter, vote_limiter]
