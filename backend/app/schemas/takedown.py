from typing import Literal

from pydantic import BaseModel, Field

from app.models import TakedownTarget, TakedownType


class TakedownCreate(BaseModel):
    target_type: TakedownTarget
    target_id: int
    request_type: TakedownType
    requester_name: str = Field(min_length=2, max_length=50)
    requester_contact: str = Field(min_length=5, max_length=100)  # 처리 결과 통지용(이메일/전화)
    relation: Literal["본인", "대리인", "기타"]
    reason: str = Field(min_length=10, max_length=2000)


class TakedownReceipt(BaseModel):
    public_code: str
    status: str
    due_at: str
    message: str


class TakedownStatusOut(BaseModel):
    public_code: str
    status: str
    request_type: str
    target_type: str
    created_at: str
    due_at: str
    resolved_at: str | None
    resolution_note: str | None
