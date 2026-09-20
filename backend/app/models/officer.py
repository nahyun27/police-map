import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.geo import Department, Station


class OfficerSource(str, enum.Enum):
    """정보 출처. 모든 수사관 정보에는 출처를 남긴다(운영원칙)."""

    announcement = "announcement"  # 인사발령 공고
    homepage = "homepage"  # 관서 홈페이지 공개정보
    media = "media"  # 언론보도
    verified_report = "verified_report"  # 사건서류로 검증된 이용자 제보


SOURCE_LABELS = {
    OfficerSource.announcement: "인사발령 공고",
    OfficerSource.homepage: "관서 홈페이지 공개정보",
    OfficerSource.media: "언론보도",
    OfficerSource.verified_report: "이용자 제보(사건서류 검증)",
}


class Officer(Base):
    """게재 정보는 성명·계급·소속 등 직무 관련 정보로 한정한다(사진·연락처·사생활 정보 컬럼을 만들지 않는다)."""

    __tablename__ = "officers"

    id: Mapped[int] = mapped_column(primary_key=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"), index=True)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"))
    name: Mapped[str] = mapped_column(String(50), index=True)
    rank: Mapped[str] = mapped_column(String(30))
    source: Mapped[OfficerSource] = mapped_column(Enum(OfficerSource, native_enum=False, length=30))

    # is_published: 운영진이 게재 여부를 관리 / is_blinded: 삭제·정정 요청 접수로 인한 임시조치
    is_published: Mapped[bool] = mapped_column(default=True)
    is_blinded: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    station: Mapped[Station] = relationship(back_populates="officers")
    department: Mapped[Department | None] = relationship()
    assignments: Mapped[list["OfficerAssignment"]] = relationship(
        back_populates="officer", order_by="OfficerAssignment.id", cascade="all, delete-orphan"
    )

    @property
    def is_visible(self) -> bool:
        return self.is_published and not self.is_blinded


class OfficerAssignment(Base):
    """소속 이력(공개자료 기준)."""

    __tablename__ = "officer_assignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    officer_id: Mapped[int] = mapped_column(ForeignKey("officers.id"), index=True)
    period: Mapped[str] = mapped_column(String(20))  # 예: "2024.02"
    description: Mapped[str] = mapped_column(String(200))  # 예: "서울강남경찰서 수사과"

    officer: Mapped[Officer] = relationship(back_populates="assignments")
