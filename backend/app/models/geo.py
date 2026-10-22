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
    # 관서 종류. station=경찰서(경찰단 포함), provincial=시·도경찰청, national=경찰청 본청·국가수사본부.
    # 2026-10 의뢰인 요청으로 시·도경찰청과 본청도 직속 수사부서를 두고 평가할 수 있게 같은 테이블에 넣었다.
    # 관할구역 지도·인근 경찰서·"관할 경찰서 N곳" 같은 경찰서 전용 표시는 kind 로 구분한다.
    kind: Mapped[str] = mapped_column(String(20), default="station", server_default="station", index=True)
    # 검색용 별칭. 공식 이름(서울특별시경찰청)과 사람들이 실제로 치는 말(서울청, 서울경찰청)이 달라서 둔다.
    search_alias: Mapped[str | None] = mapped_column(String(100))

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
