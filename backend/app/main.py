from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.v1 import admin as admin_v1
from app.api.v1 import auth as auth_v1
from app.api.v1 import community as community_v1
from app.api.v1 import public as public_v1
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
    takedown_v1.router, admin_v1.router,
):
    app.include_router(r, prefix=settings.API_V1_PREFIX)


@app.get("/health", tags=["health"])
def health() -> dict[str, str]:
    return {"status": "ok"}
