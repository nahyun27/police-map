from pydantic import BaseModel, Field, model_validator

from app.models import PostCategory


class RegionFollowOut(BaseModel):
    region_id: str
    region_name: str
    region_full_name: str


class VoteIn(BaseModel):
    """value=1 추천, value=-1 비추천, value=0 은 기존 투표 취소."""
    value: int = Field(ge=-1, le=1)


class VoteSummary(BaseModel):
    up: int
    down: int
    score: int
    my_vote: int  # 비로그인/미투표는 0


class ScrapStatus(BaseModel):
    scrapped: bool


class CommentCreate(BaseModel):
    body: str = Field(min_length=1, max_length=1000)
    parent_id: int | None = None

    @model_validator(mode="after")
    def _normalize(self):
        self.body = self.body.strip()
        if not self.body:
            raise ValueError("댓글 내용을 입력해 주세요.")
        return self


class CommentOut(BaseModel):
    """소프트 삭제된 댓글은 body 를 "삭제된 댓글입니다"로 가려서 내려준다(행은 트리 유지를 위해 남김)."""
    id: int
    author_nickname: str
    body: str
    is_removed: bool
    is_mine: bool
    parent_id: int | None
    created_at: str | None
    replies: list["CommentOut"] = []


CommentOut.model_rebuild()


class PostCreate(BaseModel):
    region_id: str
    station_id: int | None = None
    category: PostCategory = PostCategory.chat
    title: str = Field(min_length=2, max_length=200)
    body: str = Field(min_length=1, max_length=5000)

    @model_validator(mode="after")
    def _normalize(self):
        self.title = self.title.strip()
        self.body = self.body.strip()
        if len(self.title) < 2:
            raise ValueError("제목을 2자 이상 입력해 주세요.")
        if not self.body:
            raise ValueError("내용을 입력해 주세요.")
        return self


class PostOut(BaseModel):
    id: int
    author_nickname: str
    is_mine: bool
    region_id: str
    region_name: str
    station_id: int | None
    station_name: str | None
    category: str
    category_label: str
    title: str
    body: str
    view_count: int
    comment_count: int
    score: int
    my_vote: int
    is_scrapped: bool
    created_at: str | None
    updated_at: str | None


class PostReceipt(BaseModel):
    id: int
    message: str


class FeedReviewOut(BaseModel):
    """로그인 회원의 관심 지역에 새로 게시된 평가 알림용 — 공개 리뷰 카드에 지역·경찰서 정보를 더한 것."""
    id: int
    station_id: int
    station_name: str
    region_id: str
    region_name: str
    role_label: str
    case_type_label: str
    overall: float | None
    body: str
    published_at: str | None
