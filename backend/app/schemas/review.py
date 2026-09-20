from pydantic import BaseModel, Field, model_validator

from app.models import CaseType, ReviewRole


class RatingsIn(BaseModel):
    fair: int | None = Field(default=None, ge=1, le=5)
    proc: int | None = Field(default=None, ge=1, le=5)
    att: int | None = Field(default=None, ge=1, le=5)
    comm: int | None = Field(default=None, ge=1, le=5)
    speed: int | None = Field(default=None, ge=1, le=5)


class ReviewCreate(BaseModel):
    officer_id: int
    role: ReviewRole
    case_type: CaseType
    # 게시되지 않고 경험 검증에만 쓴다.
    case_number: str = Field(min_length=4, max_length=100)
    ratings: RatingsIn
    body: str = Field(default="", max_length=2000)

    @model_validator(mode="after")
    def _at_least_one_rating(self):
        if all(v is None for v in self.ratings.model_dump().values()):
            raise ValueError("별점 항목을 1개 이상 입력해 주세요.")
        self.case_number = self.case_number.strip()
        self.body = self.body.strip()
        return self


class MyReviewOut(BaseModel):
    id: int
    officer_id: int
    officer_name: str
    status: str
    reject_reason: str | None
    ratings: dict[str, int | None]
    body: str
    created_at: str
