from typing import Generic, TypeVar

from pydantic import BaseModel

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


class StationDetail(BaseModel):
    id: int
    name: str
    address: str | None
    website: str | None
    source: str | None
    region: RegionRef
    departments: list[str]
    rating: RatingSummary
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
