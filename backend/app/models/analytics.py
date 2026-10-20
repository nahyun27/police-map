"""방문 통계(자체 수집). 외부 분석 도구(구글 애널리틱스 등)와 추적 쿠키를 쓰지 않고, 페이지를 볼 때마다 한 줄씩 남긴다.
원래 IP 는 저장하지 않는다. "같은 날 같은 사람"을 한 명으로 세기 위한 visitor_hash 만 남기는데, 날짜가 섞인 해시라
다음 날이면 같은 사람도 다른 값이 되어 사람을 날짜를 넘어 따라갈 수 없다(services/analytics.py)."""
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class PageView(Base):
    __tablename__ = "page_views"
    __table_args__ = (Index("ix_page_views_day_visitor", "day", "visitor_hash"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, index=True)  # 한국 시간 기준 날짜
    path: Mapped[str] = mapped_column(String(300), index=True)  # 쿼리스트링 제외(검색어 등이 남지 않게)
    referrer_host: Mapped[str | None] = mapped_column(String(120))  # 외부 유입 사이트 도메인만
    visitor_hash: Mapped[str] = mapped_column(String(32))
    device: Mapped[str] = mapped_column(String(10))  # mobile | desktop
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
