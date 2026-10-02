from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.v1._present import review_public
from app.core.database import get_db
from app.models import Department, PublicStatistic, Region, Review, ReviewStatus, Station
from app.schemas.public import (
    Page, RankedStation, RecentReview, RegionDetail, RegionOut, RegionRef, SearchResult, StationDetail, StationItem,
    StatsOverview, Totals, YearValue,
)
from app.services.ratings import EMPTY, national_summary, station_summaries, visible_reviews

router = APIRouter(tags=["public"])


def _region_ref(r: Region) -> RegionRef:
    return RegionRef(id=r.id, name=r.name, full_name=r.full_name)


def _station_items(db: Session, stations: list[Station]) -> list[StationItem]:
    sums = station_summaries(db, [s.id for s in stations])
    return [
        StationItem(
            id=s.id, name=s.name, address=s.address, website=s.website,
            department_count=len(s.departments), rating=sums.get(s.id, EMPTY),
            lat=s.lat, lng=s.lng,
        )
        for s in stations
    ]


@router.get("/regions", response_model=list[RegionOut])
def list_regions(db: Session = Depends(get_db)):
    counts = dict(db.execute(select(Station.region_id, func.count(Station.id)).group_by(Station.region_id)).all())
    regions = db.scalars(select(Region).order_by(Region.id)).all()
    return [
        RegionOut(
            id=r.id, name=r.name, full_name=r.full_name, station_total=r.station_total,
            station_count=counts.get(r.id, 0), hq_address=r.hq_address, hq_website=r.hq_website,
        )
        for r in regions
    ]


@router.get("/regions/{region_id}", response_model=RegionDetail)
def get_region(region_id: str, db: Session = Depends(get_db)):
    r = db.get(Region, region_id)
    if not r:
        raise HTTPException(404, "지역을 찾을 수 없습니다.")
    stations = db.scalars(
        select(Station).where(Station.region_id == r.id).options(joinedload(Station.departments)).order_by(Station.name)
    ).unique().all()
    return RegionDetail(
        id=r.id, name=r.name, full_name=r.full_name, station_total=r.station_total,
        station_count=len(stations), hq_address=r.hq_address, hq_website=r.hq_website,
        stations=_station_items(db, list(stations)),
    )


@router.get("/stations/{station_id}", response_model=StationDetail)
def get_station(station_id: int, page: int = Query(1, ge=1), size: int = Query(10, ge=1, le=50), db: Session = Depends(get_db)):
    s = db.get(Station, station_id)
    if not s:
        raise HTTPException(404, "경찰서를 찾을 수 없습니다.")
    base = (Review.station_id == s.id, Review.status == ReviewStatus.published)
    total = db.scalar(select(func.count(Review.id)).where(*base)) or 0
    reviews = db.scalars(
        select(Review).where(*base).order_by(Review.published_at.desc(), Review.id.desc()).offset((page - 1) * size).limit(size)
    ).all()
    return StationDetail(
        id=s.id, name=s.name, address=s.address, website=s.website, source=s.source,
        region=_region_ref(s.region), departments=[d.name for d in s.departments],
        rating=station_summaries(db, [s.id]).get(s.id, EMPTY),
        reviews=Page(items=[review_public(r) for r in reviews], total=total, page=page, size=size),
        lat=s.lat, lng=s.lng,
    )


@router.get("/reviews/recent", response_model=list[RecentReview])
def recent_reviews(limit: int = Query(3, ge=1, le=20), db: Session = Depends(get_db)):
    rows = db.execute(
        visible_reviews(Review, Station)
        .join(Station, Station.id == Review.station_id)
        .order_by(Review.published_at.desc(), Review.id.desc())
        .limit(limit)
    ).all()
    return [RecentReview(**review_public(r).model_dump(), station_id=s.id, station_name=s.name) for r, s in rows]


@router.get("/search", response_model=SearchResult)
def search(q: str = Query(..., min_length=1, max_length=50), db: Session = Depends(get_db)):
    q = q.strip()
    if not q:
        raise HTTPException(422, "검색어를 입력해 주세요.")
    stations = db.scalars(
        select(Station).where(Station.name.contains(q, autoescape=True)).options(joinedload(Station.departments)).order_by(Station.name).limit(20)
    ).unique().all()
    return SearchResult(query=q, stations=_station_items(db, list(stations)))


@router.get("/stats/overview", response_model=StatsOverview)
def stats_overview(db: Session = Depends(get_db)):
    def stat_rows(key: str) -> list[PublicStatistic]:
        return list(db.scalars(select(PublicStatistic).where(PublicStatistic.key == key).order_by(PublicStatistic.year)))

    rate = stat_rows("appeal_acceptance_rate")
    stations = db.scalars(select(Station)).all()
    sums = station_summaries(db)
    ranked = sorted(
        (RankedStation(id=s.id, name=s.name, rating=sums[s.id].overall, review_count=sums[s.id].count) for s in stations if s.id in sums),
        key=lambda x: (x.rating is None, -(x.rating or 0), -x.review_count),
    )
    return StatsOverview(
        totals=Totals(
            stations=len(stations), departments=db.scalar(select(func.count(Department.id))) or 0,
            reviews=db.execute(visible_reviews(func.count(Review.id))).scalar_one(),
        ),
        national=national_summary(db),
        appeals_filed=[YearValue(year=s.year, value=s.value) for s in stat_rows("appeals_filed")],
        appeal_acceptance_rate=YearValue(year=rate[-1].year, value=rate[-1].value) if rate else None,
        station_ranking=ranked,
    )
