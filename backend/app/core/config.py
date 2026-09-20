import logging
from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)

INSECURE_DEFAULT = "change-me-in-production"


class Settings(BaseSettings):
    PROJECT_NAME: str = "PoliceMap API"
    API_V1_PREFIX: str = "/api/v1"
    ENVIRONMENT: str = "development"

    DATABASE_URL: str = Field(
        default="postgresql+psycopg2://policemap:policemap@localhost:5433/policemap",
    )

    JWT_SECRET_KEY: str = INSECURE_DEFAULT
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # 사건번호 해시용 비밀값. 바꾸면 기존 해시와 달라져 중복 평가 판별이 깨진다.
    CASE_HASH_PEPPER: str = INSECURE_DEFAULT

    # https 서비스 시 True. 로컬 http 개발에서는 False.
    COOKIE_SECURE: bool = False

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # 본인인증 연동 전에는 False. True 면 identity_verified_at 이 있는 회원만 평가 작성 가능.
    REQUIRE_IDENTITY_VERIFICATION: bool = False

    # 삭제·정정 요청 접수 후 재검토 기한(일). 운영원칙: "접수 즉시 임시조치 후 10일 내 재검토".
    TAKEDOWN_REVIEW_DAYS: int = 10

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    def assert_safe_for_production(self) -> None:
        """운영 환경에서 기본 시크릿으로 뜨는 것을 막는다."""
        if self.ENVIRONMENT != "production":
            if self.JWT_SECRET_KEY == INSECURE_DEFAULT:
                logger.warning("JWT_SECRET_KEY 가 기본값입니다. 로컬 개발에서만 사용하세요.")
            return
        problems = []
        if self.JWT_SECRET_KEY == INSECURE_DEFAULT:
            problems.append("JWT_SECRET_KEY")
        if self.CASE_HASH_PEPPER == INSECURE_DEFAULT:
            problems.append("CASE_HASH_PEPPER")
        if not self.COOKIE_SECURE:
            problems.append("COOKIE_SECURE(true 여야 함)")
        if problems:
            raise RuntimeError(f"운영 환경 설정 오류: {', '.join(problems)}")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
