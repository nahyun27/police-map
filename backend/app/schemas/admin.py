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
