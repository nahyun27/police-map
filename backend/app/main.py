from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.v1 import admin as admin_v1
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

app = FastAPI(title=settings.PROJECT_NAME)

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
):
    app.include_router(r, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}

# 관리자가 올린 광고 배너 이미지. nginx 가 /api/ 를 백엔드로 넘기므로 같은 경로로 서빙된다.
Path(settings.UPLOAD_DIR).mkdir(parents=True, exist_ok=True)
app.mount(f"{settings.API_V1_PREFIX}/uploads", StaticFiles(directory=settings.UPLOAD_DIR), name="uploads")
