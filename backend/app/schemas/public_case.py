from pydantic import BaseModel, Field, model_validator

from app.models import CaseCategory


class CaseCreate(BaseModel):
    category: CaseCategory
    title: str = Field(min_length=5, max_length=120)
    body: str = Field(min_length=30, max_length=5000)
    desired_action: str | None = Field(default=None, max_length=1000)
    station_id: int | None = None
    # 게시 기준 안내(실명·연락처·사건번호 금지, 미확인 사실 단정 금지)를 읽었다는 확인.
    agreed: bool

    @model_validator(mode="after")
    def _normalize(self):
        if not self.agreed:
            raise ValueError("게시 전 확인 사항에 동의해 주세요.")
        self.title, self.body = self.title.strip(), self.body.strip()
        self.desired_action = (self.desired_action or "").strip() or None
        return self


class CaseUpdateCreate(BaseModel):
    body: str = Field(min_length=5, max_length=2000)

    @model_validator(mode="after")
    def _strip(self):
        self.body = self.body.strip()
        return self


class CaseReceipt(BaseModel):
    id: int
    status: str
    message: str


class CaseUpdateOut(BaseModel):
    id: int
    body: str
    created_at: str | None


class CaseCard(BaseModel):
    id: int
    category: str
    category_label: str
    title: str
    excerpt: str
    station_id: int | None
    station_name: str | None
    empathy_count: int
    view_count: int
    update_count: int
    created_at: str | None
    my_empathy: bool = False


class CaseDetail(CaseCard):
    body: str
    desired_action: str | None
    updates: list[CaseUpdateOut]
    is_mine: bool = False
    # 아래는 작성자 본인·관리자에게만 채워진다(공개 응답에서는 status=published, 나머지 None).
    status: str
    hold_reason: str | None = None
    blind_reason: str | None = None


class EmpathyOut(BaseModel):
    empathized: bool
    empathy_count: int


class MyCaseOut(BaseModel):
    id: int
    title: str
    category_label: str
    status: str
    hold_reason: str | None
    blind_reason: str | None
    removed_reason: str | None
    empathy_count: int
    created_at: str | None


class AdminCaseOut(BaseModel):
    id: int
    author_nickname: str | None
    title: str
    body: str
    desired_action: str | None
    category_label: str
    station_name: str | None
    status: str
    hold_reason: str | None
    blind_reason: str | None
    empathy_count: int
    pending_reporters: int
    created_at: str | None
