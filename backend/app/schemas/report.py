from pydantic import BaseModel, Field, model_validator

from app.models import ReportTarget


class ReportCreate(BaseModel):
    target_type: ReportTarget
    target_id: int
    reason: str = Field(min_length=5, max_length=500)

    @model_validator(mode="after")
    def _strip(self):
        self.reason = self.reason.strip()
        return self


class ReportReceipt(BaseModel):
    id: int
    message: str


class ResolveReportIn(BaseModel):
    action: str = Field(pattern="^(remove|dismiss)$")
    note: str = Field(min_length=5, max_length=500)


class AdminReportOut(BaseModel):
    id: int
    reporter_nickname: str
    target_type: str
    target_id: int
    target_preview: str
    reason: str
    status: str
    resolved_by: int | None
    resolution_action: str | None
    resolution_note: str | None
    created_at: str | None
    # 평가·게시글·사건만 블라인드 대상(댓글·해명은 None). 관리자가 신고 큐에서 바로 블라인드/해제할 수 있게.
    target_blinded: bool | None = None
    # True 면 신고 누적 자동 블라인드 — 이 신고를 기각하면 게시물이 다시 공개된다(관리자 화면에서 경고).
    target_blind_auto: bool = False
    pending_reporters: int = 0


class BlindIn(BaseModel):
    target_type: ReportTarget
    target_id: int
    reason: str | None = Field(default=None, max_length=200)


class BlindedItemOut(BaseModel):
    target_type: str
    target_id: int
    title: str
    blind_reason: str | None
    is_auto: bool
    pending_reporters: int
