"""방문 기록 수집(공개)과 방문 통계(관리자)."""
from datetime import timedelta

from fastapi import APIRouter, Depends, Request, Response, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_admin
from app.core.rate_limit import track_limiter
from app.models import PageView
from app.services import analytics as an

router = APIRouter(tags=["analytics"])
admin_router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])


class TrackIn(BaseModel):
    path: str = Field(max_length=2000)
    referrer: str | None = Field(default=None, max_length=2000)


@router.post("/track", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(track_limiter)])
def track(body: TrackIn, request: Request, db: Session = Depends(get_db)):
    """페이지를 볼 때마다 브라우저가 보낸다. 실패해도 화면에는 영향이 없도록 항상 204 로 답한다."""
    ua = request.headers.get("user-agent", "")
    path = an.clean_path(body.path)
    if path and not an.is_bot(ua):
        day = an.today_kst()
        db.add(PageView(
            day=day, path=path, referrer_host=an.referrer_host(body.referrer),
            visitor_hash=an.visitor_hash(day, an.client_ip(request), ua),
            device="mobile" if "Mobi" in ua else "desktop",
        ))
        db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


class TrafficDay(BaseModel):
    day: str
    visitors: int
    pageviews: int


class TrafficSummary(BaseModel):
    visitors: int
    pageviews: int


class TrafficOut(BaseModel):
    today: TrafficSummary
    yesterday: TrafficSummary
    last_7d: TrafficSummary
    last_30d: TrafficSummary
    daily: list[TrafficDay]  # 최근 14일
    top_pages: list[tuple[str, int]]  # 최근 7일
    top_referrers: list[tuple[str, int]]  # 최근 7일
    mobile_ratio: float  # 최근 7일 방문 중 모바일 비율(0~1)


@admin_router.get("/stats/traffic", response_model=TrafficOut)
def traffic(db: Session = Depends(get_db)):
    """방문자 수는 "날마다 서로 다른 사람 수"의 합이다(같은 사람이 이틀 오면 2로 센다. 날짜를 넘어 사람을 잇지 않기 때문)."""
    days30 = an.last_days(30)
    rows = db.execute(
        select(PageView.day, func.count(func.distinct(PageView.visitor_hash)), func.count(PageView.id))
        .where(PageView.day >= days30[0]).group_by(PageView.day)
    ).all()
    by_day = {d: (v, p) for d, v, p in rows}

    def summary(days) -> TrafficSummary:
        return TrafficSummary(
            visitors=sum(by_day.get(d, (0, 0))[0] for d in days), pageviews=sum(by_day.get(d, (0, 0))[1] for d in days),
        )

    today = days30[-1]
    since7 = today - timedelta(days=6)
    top_pages = db.execute(
        select(PageView.path, func.count(PageView.id).label("n")).where(PageView.day >= since7)
        .group_by(PageView.path).order_by(func.count(PageView.id).desc()).limit(10)
    ).all()
    top_refs = db.execute(
        select(PageView.referrer_host, func.count(PageView.id)).where(PageView.day >= since7, PageView.referrer_host.is_not(None))
        .group_by(PageView.referrer_host).order_by(func.count(PageView.id).desc()).limit(10)
    ).all()
    total7 = db.scalar(select(func.count(PageView.id)).where(PageView.day >= since7)) or 0
    mobile7 = db.scalar(select(func.count(PageView.id)).where(PageView.day >= since7, PageView.device == "mobile")) or 0
    return TrafficOut(
        today=summary([today]), yesterday=summary([today - timedelta(days=1)]),
        last_7d=summary(days30[-7:]), last_30d=summary(days30),
        daily=[TrafficDay(day=d.isoformat(), visitors=by_day.get(d, (0, 0))[0], pageviews=by_day.get(d, (0, 0))[1]) for d in days30[-14:]],
        top_pages=[(p, n) for p, n in top_pages], top_referrers=[(h, n) for h, n in top_refs],
        mobile_ratio=round(mobile7 / total7, 3) if total7 else 0.0,
    )
