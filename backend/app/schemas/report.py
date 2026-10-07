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
