from datetime import datetime, timedelta, timezone
from math import asin, cos, radians, sin, sqrt

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.v1._present import officer_label, reply_out, review_public
from app.core.database import get_db
from app.core.deps import get_client_ip_hash, get_current_user_optional
from app.core.rate_limit import view_limiter
from app.models import (
    Department, Officer, PublicStatistic, Region, Report, ReportStatus, Review, ReviewComment, ReviewScrap, ReviewStatus,
    ReviewVote, Station, TakedownRequest, TakedownStatus, User,
)
from app.schemas.public import (
    CaseTypeSummary, NearbyStation, Page, RankedStation, RecentReview, RegionDetail, RegionOut, RegionRef,
    SearchResult, StationDetail, StationItem, StationTargets, StatsOverview, TargetOption, TargetSummary, Totals, TransparencyQuarter, TransparencyReport,
    YearValue,
)
from app.services.engagement import comment_counts, reply_rows, scrapped_set, vote_summaries
from app.models.review import CASE_TYPE_LABELS
from app.services.names import mask_name
from app.services.ratings import (
    EMPTY, national_summary, station_case_type_summaries, station_summaries, station_target_summaries, visible_reviews,
)

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
    request: Request, station_id: int, page: int = Query(1, ge=1), size: int = Query(10, ge=1, le=50),
    evidence_only: bool = Query(False, description="증빙확인된 평가만 보기"),
    department_id: int | None = Query(None, description="이 부서 대상 평가만"),
    officer_id: int | None = Query(None, description="이 수사관 대상 평가만"),
    db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional),
):
    s = db.get(Station, station_id)
    if not s:
        raise HTTPException(404, "경찰서를 찾을 수 없습니다.")
    base = (Review.station_id == s.id, Review.status == ReviewStatus.published)
    if evidence_only:
        base = (*base, Review.evidence_verified.is_(True))
    filter_label = None
    if officer_id:
        o = db.get(Officer, officer_id)
        if o and o.station_id == s.id:
            base = (*base, Review.officer_id == officer_id)
            filter_label = officer_label(o)
    elif department_id:
        d = db.get(Department, department_id)
        if d and d.station_id == s.id:
            base = (*base, Review.department_id == department_id)
            filter_label = d.name
    total = db.scalar(select(func.count(Review.id)).where(*base)) or 0
    reviews = db.scalars(
        select(Review).where(*base).order_by(Review.published_at.desc(), Review.id.desc()).offset((page - 1) * size).limit(size)
    ).all()
    ids = [r.id for r in reviews]
    uid = user.id if user else None
    votes = vote_summaries(db, ReviewVote, ReviewVote.review_id, ids, uid, None if uid else get_client_ip_hash(request))
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
    dept_sums = station_target_summaries(db, s.id, Review.department_id)
    officer_sums = station_target_summaries(db, s.id, Review.officer_id)
    dept_names = dict(db.execute(select(Department.id, Department.name).where(Department.id.in_(dept_sums))).all()) if dept_sums else {}
    officers = {o.id: o for o in db.scalars(select(Officer).where(Officer.id.in_(officer_sums)))} if officer_sums else {}
    department_ratings = sorted(
        (TargetSummary(kind="department", id=did, label=dept_names[did], rating=sm) for did, sm in dept_sums.items() if did in dept_names),
        key=lambda t: -t.rating.count,
    )
    # 비공개 처리(삭제·정정 요청 등)된 수사관은 요약 목록에서 아예 뺀다.
    officer_ratings = sorted(
        (TargetSummary(kind="officer", id=oid, label=mask_name(o.name), rank=o.rank or None,
                       department_name=o.department.name if o.department else None, rating=officer_sums[oid])
         for oid, o in officers.items() if o.is_visible),
        key=lambda t: -t.rating.count,
    )
    return StationDetail(
        id=s.id, name=s.name, address=s.address, website=s.website, source=s.source,
        region=_region_ref(s.region), departments=[d.name for d in s.departments],
        rating=station_summaries(db, [s.id]).get(s.id, EMPTY), by_case_type=by_case_type, nearby=nearby,
        reviews=Page(items=items, total=total, page=page, size=size),
        lat=s.lat, lng=s.lng, department_ratings=department_ratings, officer_ratings=officer_ratings,
        filter_label=filter_label,
    )


@router.get("/stations/{station_id}/targets", response_model=StationTargets)
def station_targets(station_id: int, db: Session = Depends(get_db)):
    """평가 작성 화면용: 이 경찰서의 부서 목록과, 이용자들이 이미 등록한 수사관 목록(가린 이름).
    비공개 처리된 수사관은 빼서 다시 평가 대상으로 고를 수 없게 한다."""
    s = db.get(Station, station_id)
    if not s:
        raise HTTPException(404, "경찰서를 찾을 수 없습니다.")
    depts = db.scalars(select(Department).where(Department.station_id == s.id).order_by(Department.name)).all()
    offs = db.scalars(
        select(Officer).options(joinedload(Officer.department))
        .where(Officer.station_id == s.id, Officer.is_published.is_(True), Officer.is_blinded.is_(False))
        .order_by(Officer.name)
    ).all()
    return StationTargets(
        departments=[TargetOption(id=d.id, label=d.name) for d in depts],
        officers=[
            TargetOption(id=o.id, label=mask_name(o.name), rank=o.rank or None, department_id=o.department_id,
                         department_name=o.department.name if o.department else None)
            for o in offs
        ],
    )


@router.get("/reviews/recent", response_model=list[RecentReview])
def recent_reviews(
    request: Request,
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
    votes = vote_summaries(db, ReviewVote, ReviewVote.review_id, ids, uid, None if uid else get_client_ip_hash(request))
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


_TRANSPARENCY_QUARTERS_BACK = 8  # 최근 2년(8분기)치만 — 사이트 운영 기간이 길어져도 매 요청
# 비용이 늘지 않게 전체 이력 대신 최근 구간으로만 훑는다.


def _quarter_counts(db: Session, time_col, where) -> dict[tuple[int, int], int]:
    """(연도, 분기) 별 건수. SQLite(테스트)·Postgres(운영) 양쪽에서 똑같이 동작하도록 DB 함수
    대신 파이썬에서 묶는다. 호출 빈도가 낮다는 가정만으로 기간을 무한정 열어두면 요청마다
    비용이 이력 전체에 비례해 늘어나므로, 최근 분기 구간으로 미리 잘라서 쿼리한다."""
    since = datetime.now(timezone.utc) - timedelta(days=_TRANSPARENCY_QUARTERS_BACK * 91)
    counts: dict[tuple[int, int], int] = {}
    for (ts,) in db.execute(select(time_col).where(*where, time_col.is_not(None), time_col >= since)).all():
        key = (ts.year, (ts.month - 1) // 3 + 1)
        counts[key] = counts.get(key, 0) + 1
    return counts


@router.get("/stats/transparency", response_model=TransparencyReport, dependencies=[Depends(view_limiter)])
def transparency_report(db: Session = Depends(get_db)):
    """운영원칙의 "분기별 투명성 보고서(게시·반려·삭제 건수) 공개" 약속을 채우는 집계.
    평가 반려/삭제는 reviewed_at, 신고·삭제요청 처리는 resolved_at 기준으로 분기를 나눈다.
    비로그인으로도 호출되는 공개 엔드포인트라 다른 공개 조회와 마찬가지로 요청 제한을 둔다."""
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
