"""평점 집계. 게시(published) 상태인 평가만 집계에 포함한다."""
from sqlalchemy import Float, Select, case, cast, func, select
from sqlalchemy.orm import Session

from app.models import CaseType, Review, ReviewStatus
from app.schemas.public import RatingSummary

DIMS = ("fair", "proc", "att", "comm", "speed")


def _r(v: float | None) -> float | None:
    return None if v is None else round(float(v), 1)


def overall_expr():
    """리뷰 1건의 종합 점수 = 입력된 항목 점수의 평균(미입력 항목은 제외)."""
    cols = [getattr(Review, d) for d in DIMS]
    total = func.coalesce(cols[0], 0)
    n = case((cols[0].is_not(None), 1), else_=0)
    for c in cols[1:]:
        total = total + func.coalesce(c, 0)
        n = n + case((c.is_not(None), 1), else_=0)
    return cast(total, Float) / func.nullif(n, 0)


def visible_reviews(*columns) -> Select:
    """공개 대상 평가 쿼리의 공통 뼈대."""
    return select(*columns).select_from(Review).where(Review.status == ReviewStatus.published)


def _summary_columns():
    return [*(func.avg(getattr(Review, d)) for d in DIMS), func.avg(overall_expr()), func.count(Review.id)]


def _to_summary(row) -> RatingSummary:
    *dims, overall, count = row
    return RatingSummary(**{d: _r(v) for d, v in zip(DIMS, dims)}, overall=_r(overall), count=int(count))


EMPTY = RatingSummary(count=0)


def station_summaries(db: Session, station_ids: list[int] | None = None) -> dict[int, RatingSummary]:
    q = visible_reviews(Review.station_id, *_summary_columns()).group_by(Review.station_id)
    if station_ids is not None:
        q = q.where(Review.station_id.in_(station_ids))
    return {row[0]: _to_summary(row[1:]) for row in db.execute(q)}


def national_summary(db: Session) -> RatingSummary:
    row = db.execute(visible_reviews(*_summary_columns())).one()
    return _to_summary(row)


def station_case_type_summaries(db: Session, station_id: int) -> dict[CaseType, RatingSummary]:
    """한 경찰서의 평가를 사건유형별로 쪼갠 집계. 전체 평균 하나로만 뭉뚱그려 보여주던 걸
    보완 — "이 경찰서가 특정 사건유형에서 특히 약한가"를 볼 수 있게 한다."""
    q = (
        visible_reviews(Review.case_type, *_summary_columns())
        .where(Review.station_id == station_id).group_by(Review.case_type)
    )
    return {row[0]: _to_summary(row[1:]) for row in db.execute(q)}
