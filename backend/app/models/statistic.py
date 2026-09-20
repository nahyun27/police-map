from sqlalchemy import Float, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PublicStatistic(Base):
    """정보공개청구 등으로 확보한 공식 통계(예: 연도별 수사관 기피신청 건수)."""

    __tablename__ = "public_statistics"
    __table_args__ = (UniqueConstraint("key", "year"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(50), index=True)
    year: Mapped[int]
    value: Mapped[float] = mapped_column(Float)
    source: Mapped[str] = mapped_column(String(200))
