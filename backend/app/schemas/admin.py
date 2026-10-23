from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.models import OfficerSource


class RejectIn(BaseModel):
    reason: str = Field(min_length=5, max_length=500)


class EvidenceVerifyIn(BaseModel):
    verified: bool


class ResolveIn(BaseModel):
    decision: Literal["keep", "remove"]
    note: str = Field(min_length=5, max_length=2000)


class AssignmentIn(BaseModel):
    period: str = Field(min_length=1, max_length=20)
    description: str = Field(min_length=1, max_length=200)


class OfficerCreate(BaseModel):
    station_id: int
    name: str = Field(min_length=2, max_length=50)
    rank: str = Field(min_length=1, max_length=30)
    source: OfficerSource
    department_name: str | None = Field(default=None, max_length=100)
    assignments: list[AssignmentIn] = []


class OfficerUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=50)
    rank: str | None = Field(default=None, min_length=1, max_length=30)
    source: OfficerSource | None = None
    department_name: str | None = Field(default=None, max_length=100)
    is_published: bool | None = None
    assignments: list[AssignmentIn] | None = None  # 주어지면 전체 교체


class StationCreate(BaseModel):
    region_id: str
    name: str = Field(min_length=2, max_length=100)
    address: str | None = Field(default=None, max_length=200)
    website: str | None = Field(default=None, max_length=200)
    department_names: list[str] = []


class UserStatsOut(BaseModel):
    """가입 회원 통계. 방문자 수(트래픽) 통계는 아직 수집하는 인프라 자체가 없어서 포함하지
    않는다 — 이 플랫폼은 로그인 없이도 평가·글 작성이 다 되고, 민감한 신고 목적의 방문자도
    있을 수 있어 트래픽 분석 도구(GA 등)를 넣을지는 별도로 정할 사안이다."""
    total_users: int
    new_7d: int
    new_30d: int
    officer_verified: int
    daily_signups: list[tuple[str, int]]  # 최근 14일, (날짜, 가입 수)


class AdminUserOut(BaseModel):
    """회원 관리 목록 한 줄. 이메일은 회원 관리 목적(개인정보처리방침의 수집 목적) 안에서 관리자에게만 보인다."""
    id: int
    email: str
    nickname: str
    role: str
    status: str  # active | suspended | withdrawn
    created_at: str | None
    suspended_at: str | None
    suspend_reason: str | None
    officer_verified: bool
    review_count: int
    post_count: int
    comment_count: int
    case_count: int
    reports_received: int


class SuspendIn(BaseModel):
    reason: str = Field(min_length=2, max_length=300)

    @field_validator("reason")
    @classmethod
    def _strip(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("정지 사유를 2자 이상 적어 주세요.")
        return v


class AdminUserContentItem(BaseModel):
    kind: str  # review | post | review_comment | post_comment | public_case
    kind_label: str
    id: int
    text: str
    state: str
    created_at: str | None
    link: str | None


class DashboardPending(BaseModel):
    """처리를 기다리는 일. 0 이 아니면 대시보드에서 해당 메뉴로 안내한다."""
    reports: int
    takedowns: int
    takedowns_overdue: int  # 10일 재검토 기한을 넘긴 삭제·정정 요청
    verifications: int
    cases_held: int
    inquiries: int
    reviews: int  # 2026-10 이전 검수 대기열(신규 평가는 바로 게시)


class DashboardActivity(BaseModel):
    kind: str
    kind_label: str
    text: str
    created_at: str | None
    link: str | None  # 공개 화면 또는 관리자 화면 경로


class DashboardOut(BaseModel):
    pending: DashboardPending
    totals: dict[str, int]  # 누적 평가·게시글·사건·회원 수
    recent: list[DashboardActivity]
