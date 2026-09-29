from pydantic import BaseModel, Field, model_validator

from app.models import CaseType, ReviewRole


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
    # 선택 입력. 게시되지 않고 경험 검증·중복 제출 방지에만 쓴다.
    case_number: str | None = Field(default=None, max_length=100)
    ratings: RatingsIn
    body: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def _normalize(self):
        if all(v is None for v in self.ratings.model_dump().values()):
            raise ValueError("별점 항목을 1개 이상 입력해 주세요.")
        if self.case_number is not None:
            self.case_number = self.case_number.strip() or None
        if self.case_number is not None and len(self.case_number) < 4:
            raise ValueError("사건번호는 4자 이상으로 입력하거나 비워 주세요.")
        self.body = self.body.strip()
        return self


class ReviewReceipt(BaseModel):
    id: int
    status: str
    message: str
