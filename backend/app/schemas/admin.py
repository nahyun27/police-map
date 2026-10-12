from typing import Literal

from pydantic import BaseModel, Field

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
