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
    takedown_pending: bool = False  # 처리 대기 중인 삭제·정정 요청이 있으면 해제는 요청 처리로만 한다


class AdminContentSection(BaseModel):
    label: str
    text: str


class AdminContentOut(BaseModel):
    """블라인드·삭제 요청 판단용 원문. 관리자 전용이라 수사관 실명·작성자 정보를 가리지 않는다."""
    kind: str
    id: int
    title: str
    status: str
    author: str
    created_at: str | None
    meta: list[str]
    ratings: dict[str, int | None] | None = None
    body: str
    sections: list[AdminContentSection] = []
