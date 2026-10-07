from pydantic import BaseModel, Field, model_validator


class VerifyCreate(BaseModel):
    station_id: int
    name: str = Field(min_length=2, max_length=50)
    rank: str = Field(min_length=1, max_length=30)
    department: str | None = Field(default=None, max_length=100)
    # 비공개. 경찰 공식 도메인 메일(@police.go.kr 등)이면 신뢰도가 높다.
    contact: str = Field(min_length=3, max_length=200)
    proof_note: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def _strip(self):
        self.name, self.rank, self.contact = self.name.strip(), self.rank.strip(), self.contact.strip()
        if self.department is not None:
            self.department = self.department.strip() or None
        if self.proof_note is not None:
            self.proof_note = self.proof_note.strip() or None
        return self


class VerifyOut(BaseModel):
    """신청 본인과 관리자에게만 보여주는 뷰 — 공개 화면에는 절대 쓰지 않는다(연락처 포함)."""
    id: int
    station_id: int
    station_name: str
    name: str
    rank: str
    department: str | None
    contact: str
    proof_note: str | None
    status: str
    reject_reason: str | None
    created_at: str | None


class AdminVerifyOut(VerifyOut):
    """관리자 전용 — 신청자 계정 정보까지 포함."""
    user_id: int
    user_email: str
    user_nickname: str


class ReplyCreate(BaseModel):
    body: str = Field(min_length=1, max_length=2000)
    show_name: bool = False

    @model_validator(mode="after")
    def _strip(self):
        self.body = self.body.strip()
        if not self.body:
            raise ValueError("해명 내용을 입력해 주세요.")
        return self


class ReplyOut(BaseModel):
    id: int
    review_id: int
    author_label: str  # show_name 에 따라 실명 또는 "계급(부서)"
    show_name: bool
    is_mine: bool
    body: str
    created_at: str | None
    updated_at: str | None
