from typing import Generic, TypeVar

from pydantic import BaseModel

from app.schemas.verification import ReplyOut

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    size: int


class RatingSummary(BaseModel):
    fair: float | None = None
    proc: float | None = None
    att: float | None = None
    comm: float | None = None
    speed: float | None = None
    overall: float | None = None
    count: int = 0


class RegionOut(BaseModel):
    id: str
    name: str
    full_name: str
    station_total: int  # 실제 관할 경찰서 수
    station_count: int  # 현재 DB 에 등록된 경찰서 수
    hq_address: str | None = None
    hq_website: str | None = None


class StationItem(BaseModel):
    id: int
    name: str
    address: str | None
    website: str | None
    department_count: int
    rating: RatingSummary
    lat: float | None = None
    lng: float | None = None


class RegionDetail(RegionOut):
    stations: list[StationItem]


class RegionRef(BaseModel):
    id: str
    name: str
    full_name: str


class ReviewPublic(BaseModel):
    id: int
    role: str
    role_label: str
    case_type: str
    case_type_label: str
    ratings: dict[str, int | None]
    overall: float | None
    body: str
    published_at: str | None
    comment_count: int = 0
    score: int = 0  # 추천 - 비추천
    my_vote: int = 0  # 로그인 + 투표한 경우만 1/-1, 그 외 0
    evidence_verified: bool = False  # 운영자가 증빙자료를 확인했을 때만 true(공개 배지용)
    reply: ReplyOut | None = None  # 인증된 경찰관의 공식 해명(있으면)
    is_scrapped: bool = False  # 로그인 + 스크랩한 경우만 true


class CaseTypeSummary(BaseModel):
    case_type: str
    case_type_label: str
    rating: RatingSummary


class NearbyStation(BaseModel):
    id: int
    name: str
    distance_km: float
    rating: RatingSummary


class StationDetail(BaseModel):
    id: int
    name: str
    address: str | None
    website: str | None
    source: str | None
    region: RegionRef
    departments: list[str]
    rating: RatingSummary
    by_case_type: list[CaseTypeSummary] = []
    nearby: list[NearbyStation] = []
    reviews: Page[ReviewPublic]
    lat: float | None = None
    lng: float | None = None


class RecentReview(ReviewPublic):
    station_id: int
    station_name: str


class SearchResult(BaseModel):
    query: str
    stations: list[StationItem]


class Totals(BaseModel):
    stations: int
    departments: int
    reviews: int


class YearValue(BaseModel):
    year: int
    value: float


class RankedStation(BaseModel):
    id: int
    name: str
    rating: float | None
    review_count: int


class StatsOverview(BaseModel):
    totals: Totals
    national: RatingSummary
    appeals_filed: list[YearValue]
    appeal_acceptance_rate: YearValue | None
    station_ranking: list[RankedStation]


class TransparencyQuarter(BaseModel):
    year: int
    quarter: int
    reviews_rejected: int  # 검수 반려(레거시 대기열 처리분)
    reviews_removed: int  # 관리자 사후삭제 + 신고 처리에 따른 삭제
    reports_resolved_remove: int
    reports_resolved_dismiss: int
    takedowns_removed: int
    takedowns_kept: int


class TransparencyReport(BaseModel):
    """운영원칙에 적힌 "분기별 투명성 보고서(게시·반려·삭제 건수) 공개" 를 실제로 채우는 응답.
    데이터가 쌓인 분기부터 전부(오래된 순) 내려준다."""
    quarters: list[TransparencyQuarter]
