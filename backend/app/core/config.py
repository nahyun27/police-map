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
    # 마이그레이션(alembic) 전용 접속 주소. 운영에서는 사이트가 테이블 구조를 못 바꾸는 저권한 계정으로
    # 접속하고(DATABASE_URL), 구조 변경은 이 관리자 계정 주소로만 한다. 비워 두면 DATABASE_URL 을 쓴다.
    MIGRATION_DATABASE_URL: str = ""

    JWT_SECRET_KEY: str = INSECURE_DEFAULT
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # 사건번호 해시용 비밀값. 바꾸면 기존 해시와 달라져 중복 평가 판별이 깨진다.
    CASE_HASH_PEPPER: str = INSECURE_DEFAULT

    # https 서비스 시 True. 로컬 http 개발에서는 False.
    COOKIE_SECURE: bool = False

    CORS_ORIGINS: list[str] = ["http://localhost:3000"]

    # 삭제·정정 요청 접수 후 재검토 기한(일). 운영원칙: "접수 즉시 임시조치 후 10일 내 재검토".
    TAKEDOWN_REVIEW_DAYS: int = 10

    # 관리자가 올린 광고 배너 이미지 저장 위치(/api/v1/uploads/... 로 서빙).
    UPLOAD_DIR: str = "uploads"

    # 광고·제휴 문의 이메일 알림. SMTP_HOST 와 INQUIRY_NOTIFY_TO 가 비어 있으면 메일은 보내지 않고
    # 관리자 콘솔에만 쌓인다(문의 접수 자체는 항상 성공).
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""
    INQUIRY_NOTIFY_TO: str = ""  # 쉼표로 여러 주소 가능

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )

    def assert_safe_for_production(self) -> None:
        """운영 환경에서 기본 시크릿으로 뜨는 것을 막는다. 실수로 ENVIRONMENT 를 "prod"·"Production" 처럼
        다르게 적거나 빼먹어도 검사를 건너뛰지 않도록, 명시적으로 개발·테스트라고 한 경우만 통과시킨다."""
        if self.ENVIRONMENT.strip().lower() in ("development", "dev", "test", "local"):
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
