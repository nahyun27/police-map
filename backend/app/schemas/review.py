import re

from pydantic import BaseModel, Field, model_validator

from app.models import CaseType, ReviewRole
from app.services.names import OFFICER_RANKS
from app.schemas.verification import ReplyOut


class RatingsIn(BaseModel):
    fair: int | None = Field(default=None, ge=1, le=5)
    proc: int | None = Field(default=None, ge=1, le=5)
    att: int | None = Field(default=None, ge=1, le=5)
    comm: int | None = Field(default=None, ge=1, le=5)
    speed: int | None = Field(default=None, ge=1, le=5)


class ReviewCreate(BaseModel):
    station_id: int
    role: ReviewRole
    case_type: CaseType
    # role/case_type 이 '기타(직접입력)'일 때만 쓰는 자유 입력 라벨. 선택 입력 — 비워 두면
    # 화면엔 그냥 "기타"로 표시된다.
    role_other: str | None = Field(default=None, max_length=40)
    case_type_other: str | None = Field(default=None, max_length=40)
    # 평가 대상(2026-10 의뢰인 결정). 모두 비우면 경찰서 전체 평가. 수사관은 기존 등록자(officer_id)를
    # 고르거나 이름을 새로 입력(officer_name) — 새 이름은 바로 DB 에 등록되고 공개 화면엔 가린 이름만 나간다.
    department_id: int | None = None
    officer_id: int | None = None
    officer_name: str | None = Field(default=None, max_length=20)
    officer_rank: str | None = Field(default=None, max_length=30)
    # 선택 입력. 게시되지 않고 경험 검증·중복 제출 방지에만 쓴다.
    case_number: str | None = Field(default=None, max_length=100)
    ratings: RatingsIn
    body: str = Field(default="", max_length=2000)
    # 선택 입력. 실제 서류를 받는 기능은 아직 없고, 운영자가 확인 후 수동으로 증빙배지를 달아 준다.
    evidence_note: str | None = Field(default=None, max_length=300)

    @model_validator(mode="after")
    def _normalize(self):
        if all(v is None for v in self.ratings.model_dump().values()):
            raise ValueError("별점 항목을 1개 이상 입력해 주세요.")
        if self.case_number is not None:
            self.case_number = self.case_number.strip() or None
        if self.case_number is not None and len(self.case_number) < 4:
            raise ValueError("사건번호는 4자 이상으로 입력하거나 비워 주세요.")
        self.body = self.body.strip()
        if self.evidence_note is not None:
            self.evidence_note = self.evidence_note.strip() or None
        # role/case_type 이 other 가 아니면 직접입력 값은 의미가 없으니 그냥 비워 저장한다.
        self.role_other = (self.role_other or "").strip() or None
        if self.role != ReviewRole.other:
            self.role_other = None
        self.case_type_other = (self.case_type_other or "").strip() or None
        if self.case_type != CaseType.other:
            self.case_type_other = None
        self.officer_name = re.sub(r"\s+", "", self.officer_name or "") or None
        self.officer_rank = (self.officer_rank or "").strip() or None
        if self.officer_rank is not None and self.officer_rank not in OFFICER_RANKS:
            raise ValueError("계급은 목록에서 골라 주세요.")
        if self.officer_id is not None:
            self.officer_name = None  # 기존 수사관을 골랐으면 이름 입력은 무시
        if self.officer_name is not None and not re.fullmatch(r"[가-힣]{2,5}", self.officer_name):
            raise ValueError("수사관 이름은 한글 2~5자로 입력해 주세요.")
        return self


class MyReviewState(BaseModel):
    """경찰서 상세의 평가 목록에 덧씌우는 "내 상태"(추천·스크랩·내 해명 여부)."""
    id: int
    my_vote: int
    is_scrapped: bool
    reply_is_mine: bool


class MyReviewStates(BaseModel):
    items: list[MyReviewState]


class ReviewReceipt(BaseModel):
    id: int
    status: str
    message: str


class MyReviewOut(BaseModel):
    """로그인한 본인이 작성한 평가 — 검수 상태·반려 사유까지 본인에게만 보여준다.
    사건번호는 공개 응답에 절대 넣지 않는다는 원칙을 여기도 그대로 지킨다(본인 확인용으로도 굳이 안 보여줌)."""
    id: int
    station_id: int
    station_name: str
    role: str
    role_label: str
    case_type: str
    case_type_label: str
    ratings: dict[str, int | None]
    overall: float | None
    body: str
    status: str
    reject_reason: str | None
    blind_reason: str | None = None
    target_label: str | None = None  # 부서·수사관 대상 평가면 그 이름(수사관은 가린 이름)
    created_at: str | None
    published_at: str | None
    comment_count: int = 0
    up: int = 0
    down: int = 0
    score: int = 0
    evidence_note: str | None = None
    evidence_verified: bool = False
    reply: ReplyOut | None = None
    is_scrapped: bool = False
