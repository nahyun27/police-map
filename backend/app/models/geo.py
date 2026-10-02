from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base

if TYPE_CHECKING:
    from app.models.officer import Officer


class Region(Base):
    """시·도경찰청. id 는 URL 에 쓰는 슬러그(seoul, ggs ...)."""

    __tablename__ = "regions"

    id: Mapped[str] = mapped_column(String(20), primary_key=True)
    name: Mapped[str] = mapped_column(String(30))
    full_name: Mapped[str] = mapped_column(String(50))
    # 실제 관할 경찰서 수(공식 수치). 현재 DB 에 등록된 수와 다를 수 있다.
    station_total: Mapped[int] = mapped_column(default=0)
    # 시·도경찰청(본청) 자체의 주소·홈페이지. 데이터가 없으면 None.
    hq_address: Mapped[str | None] = mapped_column(String(200))
    hq_website: Mapped[str | None] = mapped_column(String(200))

    stations: Mapped[list["Station"]] = relationship(back_populates="region")


class Station(Base):
    __tablename__ = "stations"
    __table_args__ = (UniqueConstraint("region_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    region_id: Mapped[str] = mapped_column(ForeignKey("regions.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))
    address: Mapped[str | None] = mapped_column(String(200))
    website: Mapped[str | None] = mapped_column(String(200))
    # 공개 데이터 출처(경찰청 전국경찰관서안내 등). 화면에 "출처" 표기용.
    source: Mapped[str | None] = mapped_column(String(300))
    # 주소 지오코딩 결과(scripts/geocode_stations.py). 지도에 핀을 찍을 때만 쓰고,
    # 값이 없으면 지도에서 그 관서는 생략한다(화면 로직에서 null 허용 처리 필요).
    lat: Mapped[float | None] = mapped_column()
    lng: Mapped[float | None] = mapped_column()
    is_sample: Mapped[bool] = mapped_column(default=False)

    region: Mapped[Region] = relationship(back_populates="stations")
    departments: Mapped[list["Department"]] = relationship(back_populates="station", order_by="Department.id")
    officers: Mapped[list["Officer"]] = relationship(back_populates="station")


class Department(Base):
    __tablename__ = "departments"
    __table_args__ = (UniqueConstraint("station_id", "name"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"), index=True)
    name: Mapped[str] = mapped_column(String(100))

    station: Mapped[Station] = relationship(back_populates="departments")
