from math import asin, cos, radians, sin, sqrt

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.v1._present import reply_out, review_public
from app.core.database import get_db
from app.core.deps import get_current_user_optional
from app.models import (
    Department, PublicStatistic, Region, Report, ReportStatus, Review, ReviewComment, ReviewScrap, ReviewStatus,
    ReviewVote, Station, TakedownRequest, TakedownStatus, User,
)
from app.schemas.public import (
    CaseTypeSummary, NearbyStation, Page, RankedStation, RecentReview, RegionDetail, RegionOut, RegionRef,
    SearchResult, StationDetail, StationItem, StatsOverview, Totals, TransparencyQuarter, TransparencyReport,
    YearValue,
)
from app.services.engagement import comment_counts, reply_rows, scrapped_set, vote_summaries
from app.models.review import CASE_TYPE_LABELS
from app.services.ratings import EMPTY, national_summary, station_case_type_summaries, station_summaries, visible_reviews

router = APIRouter(tags=["public"])


def _region_ref(r: Region) -> RegionRef:
    return RegionRef(id=r.id, name=r.name, full_name=r.full_name)


def _haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    r = 6371.0  # 지구 평균 반지름(km)
    p1, p2 = radians(lat1), radians(lat2)
    dp, dl = radians(lat2 - lat1), radians(lng2 - lng1)
    a = sin(dp / 2) ** 2 + cos(p1) * cos(p2) * sin(dl / 2) ** 2
    return 2 * r * asin(sqrt(a))


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
def get_station(
    station_id: int, page: int = Query(1, ge=1), size: int = Query(10, ge=1, le=50),
    evidence_only: bool = Query(False, description="증빙확인된 평가만 보기"),
    db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional),
):
    s = db.get(Station, station_id)
    if not s:
        raise HTTPException(404, "경찰서를 찾을 수 없습니다.")
    base = (Review.station_id == s.id, Review.status == ReviewStatus.published)
    if evidence_only:
        base = (*base, Review.evidence_verified.is_(True))
    total = db.scalar(select(func.count(Review.id)).where(*base)) or 0
    reviews = db.scalars(
        select(Review).where(*base).order_by(Review.published_at.desc(), Review.id.desc()).offset((page - 1) * size).limit(size)
    ).all()
    ids = [r.id for r in reviews]
    uid = user.id if user else None
    votes = vote_summaries(db, ReviewVote, ReviewVote.review_id, ids, uid)
    counts = comment_counts(db, ReviewComment, ReviewComment.review_id, ids)
    replies = reply_rows(db, ids)
    scrapped = scrapped_set(db, ReviewScrap, ReviewScrap.review_id, ids, uid)
    items = [
        review_public(
            r, votes[r.id], counts[r.id], reply_out(*replies[r.id], uid) if r.id in replies else None,
            r.id in scrapped,
        )
        for r in reviews
    ]
    by_case_type = [
        CaseTypeSummary(case_type=ct.value, case_type_label=CASE_TYPE_LABELS[ct], rating=summary)
        for ct, summary in sorted(station_case_type_summaries(db, s.id).items(), key=lambda kv: -kv[1].count)
    ]
    nearby: list[NearbyStation] = []
    if s.lat is not None and s.lng is not None:
        others = db.scalars(
            select(Station).where(Station.id != s.id, Station.lat.is_not(None), Station.lng.is_not(None), Station.is_sample.is_(False))
        ).all()
        sums = station_summaries(db, [o.id for o in others])
        nearby = sorted(
            (NearbyStation(id=o.id, name=o.name, distance_km=round(_haversine_km(s.lat, s.lng, o.lat, o.lng), 1), rating=sums.get(o.id, EMPTY))
             for o in others),
            key=lambda n: n.distance_km,
        )[:5]
    return StationDetail(
        id=s.id, name=s.name, address=s.address, website=s.website, source=s.source,
        region=_region_ref(s.region), departments=[d.name for d in s.departments],
        rating=station_summaries(db, [s.id]).get(s.id, EMPTY), by_case_type=by_case_type, nearby=nearby,
        reviews=Page(items=items, total=total, page=page, size=size),
        lat=s.lat, lng=s.lng,
    )


@router.get("/reviews/recent", response_model=list[RecentReview])
def recent_reviews(
    limit: int = Query(3, ge=1, le=20), region: str | None = Query(None, description="쉼표로 구분된 지역 id 목록"),
    db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional),
):
    q = visible_reviews(Review, Station).join(Station, Station.id == Review.station_id)
    if region:
        region_ids = [r for r in region.split(",") if r]
        q = q.where(Station.region_id.in_(region_ids))
    rows = db.execute(q.order_by(Review.published_at.desc(), Review.id.desc()).limit(limit)).all()
    ids = [r.id for r, _ in rows]
    uid = user.id if user else None
    votes = vote_summaries(db, ReviewVote, ReviewVote.review_id, ids, uid)
    counts = comment_counts(db, ReviewComment, ReviewComment.review_id, ids)
    replies = reply_rows(db, ids)
    scrapped = scrapped_set(db, ReviewScrap, ReviewScrap.review_id, ids, uid)
    return [
        RecentReview(
            **review_public(
                r, votes[r.id], counts[r.id], reply_out(*replies[r.id], uid) if r.id in replies else None,
                r.id in scrapped,
            ).model_dump(),
            station_id=s.id, station_name=s.name,
        )
        for r, s in rows
    ]


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


def _quarter_counts(db: Session, time_col, where) -> dict[tuple[int, int], int]:
    """(연도, 분기) 별 건수. SQLite(테스트)·Postgres(운영) 양쪽에서 똑같이 동작하도록 DB 함수
    대신 파이썬에서 묶는다 — 관리자/투명성 보고서 전용이라 자주 호출되지 않아 부담 없다."""
    counts: dict[tuple[int, int], int] = {}
    for (ts,) in db.execute(select(time_col).where(*where, time_col.is_not(None))).all():
        key = (ts.year, (ts.month - 1) // 3 + 1)
        counts[key] = counts.get(key, 0) + 1
    return counts


@router.get("/stats/transparency", response_model=TransparencyReport)
def transparency_report(db: Session = Depends(get_db)):
    """운영원칙의 "분기별 투명성 보고서(게시·반려·삭제 건수) 공개" 약속을 채우는 집계.
    평가 반려/삭제는 reviewed_at, 신고·삭제요청 처리는 resolved_at 기준으로 분기를 나눈다."""
    rejected = _quarter_counts(db, Review.reviewed_at, (Review.status == ReviewStatus.rejected,))
    removed = _quarter_counts(db, Review.reviewed_at, (Review.status == ReviewStatus.removed,))
    reports_remove = _quarter_counts(
        db, Report.resolved_at, (Report.status == ReportStatus.resolved, Report.resolution_action == "removed"),
    )
    reports_dismiss = _quarter_counts(
        db, Report.resolved_at, (Report.status == ReportStatus.resolved, Report.resolution_action == "dismissed"),
    )
    takedowns_removed = _quarter_counts(db, TakedownRequest.resolved_at, (TakedownRequest.status == TakedownStatus.removed,))
    takedowns_kept = _quarter_counts(db, TakedownRequest.resolved_at, (TakedownRequest.status == TakedownStatus.kept,))

    keys = sorted(set(rejected) | set(removed) | set(reports_remove) | set(reports_dismiss) | set(takedowns_removed) | set(takedowns_kept))
    return TransparencyReport(quarters=[
        TransparencyQuarter(
            year=y, quarter=q,
            reviews_rejected=rejected.get((y, q), 0), reviews_removed=removed.get((y, q), 0),
            reports_resolved_remove=reports_remove.get((y, q), 0), reports_resolved_dismiss=reports_dismiss.get((y, q), 0),
            takedowns_removed=takedowns_removed.get((y, q), 0), takedowns_kept=takedowns_kept.get((y, q), 0),
        )
        for y, q in keys
    ])
