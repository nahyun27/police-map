import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.concurrency import run_in_threadpool
from fastapi.responses import JSONResponse
from sqlalchemy.exc import DataError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1 import admin as admin_v1
from app.api.v1 import analytics as analytics_v1
from app.api.v1 import ads as ads_v1
from app.api.v1 import auth as auth_v1
from app.api.v1 import cases as cases_v1
from app.api.v1 import community as community_v1
from app.api.v1 import public as public_v1
from app.api.v1 import reports as reports_v1
from app.api.v1 import reviews as reviews_v1
from app.api.v1 import takedown as takedown_v1
from app.api.v1 import verification as verification_v1
from app.core.config import settings

settings.assert_safe_for_production()

_IS_DEV = settings.ENVIRONMENT.strip().lower() in ("development", "dev", "test", "local")

# 운영에서는 API 문서(/docs, /openapi.json)를 끈다. 지금은 nginx 가 /api/ 만 넘겨 밖에서 안 보이지만,
# 프록시 설정이 바뀌어도 전체 엔드포인트 목록이 노출되지 않도록 앱에서도 막아 둔다.
log = logging.getLogger("uvicorn.error")  # uvicorn 이 출력하는 로거라 journalctl 에 남는다
PURGE_INTERVAL_SECONDS = 24 * 60 * 60


def _purge_once() -> None:
    from app.core.database import SessionLocal
    from app.services.retention import run_purge

    with SessionLocal() as db:
        counts = run_purge(db)
    log.info("retention purge: %s", counts)


async def _purge_loop() -> None:
    """개인정보 보관 기간이 지난 기록을 서버 시작 시 한 번, 이후 하루마다 파기한다(services/retention.py).
    별도 cron 없이 앱과 함께 돌게 해 배포 설정이 하나 줄도록 했다. uvicorn 워커가 1개라 중복 실행은 없다."""
    while True:
        try:
            await run_in_threadpool(_purge_once)
        except Exception:  # 파기 실패가 서버를 멈추면 안 된다. 다음 주기에 다시 시도한다.
            log.exception("retention purge failed")
        await asyncio.sleep(PURGE_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(_: FastAPI):
    task = None if settings.ENVIRONMENT.strip().lower() == "test" else asyncio.create_task(_purge_loop())
    yield
    if task:
        task.cancel()


app = FastAPI(
    title=settings.PROJECT_NAME,
    lifespan=lifespan,
    docs_url="/docs" if _IS_DEV else None,
    redoc_url="/redoc" if _IS_DEV else None,
    openapi_url="/openapi.json" if _IS_DEV else None,
)


@app.exception_handler(DataError)
@app.exception_handler(OverflowError)
async def out_of_range(request: Request, exc: Exception):
    """/reviews/99999999999999999999 나 page=10**18 처럼 DB 정수 범위를 넘는 값이 500 오류로
    떨어지던 문제. 서버 오류가 아니라 잘못된 요청으로 답한다."""
    return JSONResponse(status_code=422, content={"detail": "요청 값이 올바르지 않습니다."})


@app.middleware("http")
async def security_headers(request: Request, call_next):
    """API 응답에도 기본 보안 헤더를 붙인다(페이지 쪽은 next.config.ts 가 담당)."""
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    if not _IS_DEV:
        response.headers.setdefault("Strict-Transport-Security", "max-age=31536000")
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (
    public_v1.router, auth_v1.router, reviews_v1.router, community_v1.router, verification_v1.router,
    reports_v1.router, takedown_v1.router, cases_v1.router, ads_v1.router, admin_v1.router, ads_v1.admin_router,
    analytics_v1.router, analytics_v1.admin_router,
):
    app.include_router(r, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}

# 관리자가 올린 광고 배너 이미지. nginx 가 /api/ 를 백엔드로 넘기므로 같은 경로로 서빙된다.
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount(f"{settings.API_V1_PREFIX}/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
