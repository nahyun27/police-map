import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.geo import Station


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    nickname: Mapped[str] = mapped_column(String(50))
    role: Mapped[UserRole] = mapped_column(Enum(UserRole, native_enum=False, length=20), default=UserRole.user)
    is_active: Mapped[bool] = mapped_column(default=True)
    # 토큰 무효화용 버전. 로그아웃·탈퇴 때 1 올리면 그 전에 발급된 모든 토큰(탈취된 것 포함)이 즉시 무효가 된다
    # (JWT 는 서버에 저장하지 않으니, 이 값과 토큰 안의 tv 를 비교해서 끊는다).
    token_version: Mapped[int] = mapped_column(default=0, server_default="0")
    # 휴대폰 본인인증 완료 시각. 연동 전에는 항상 None.
    identity_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # 가입 시 이용약관·개인정보 수집·이용·만 14세 이상 동의 시각과 그때의 약관 버전(동의 증빙용).
    # 이 기능 이전 가입자는 None.
    terms_agreed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    terms_version: Mapped[str | None] = mapped_column(String(20))
    # 탈퇴 시각. 탈퇴 후 1년이 지나면 수사관 인증 신청 기록을 파기한다(개인정보처리방침 보관 기간, services/retention.py).
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    # 경찰관 신원 인증(OfficerVerification 승인) 결과 — 전부 None 이면 미인증 일반 회원이다.
    # officer_station_id 가 있어야만 그 경찰서 리뷰에 해명(ReviewReply)을 달 수 있다.
    officer_station_id: Mapped[int | None] = mapped_column(ForeignKey("stations.id"))
    officer_name: Mapped[str | None] = mapped_column(String(50))
    officer_rank: Mapped[str | None] = mapped_column(String(30))
    officer_department: Mapped[str | None] = mapped_column(String(100))
    officer_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    officer_station: Mapped[Station | None] = relationship()
