from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, SmallInteger, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.geo import Region, Station

# 추천/비추천 값은 +1/-1 둘 중 하나만 허용한다(0은 "투표 취소"를 뜻하며 행 자체를 지운다).
# CheckConstraint 객체는 테이블마다 새로 만든다 — 하나를 여러 __table_args__ 에 공유하면
# 제약조건 이름이 먼저 붙은 테이블 이름으로 고정되어 버린다(alembic autogenerate 로 확인된 버그).
def _vote_check() -> CheckConstraint:
    return CheckConstraint("value IN (1, -1)", name="value_updown")


class RegionFollow(Base):
    """마이페이지에서 등록한 관심 지역. 여러 개 등록 가능(지역당 1행)."""

    __tablename__ = "region_follows"
    __table_args__ = (UniqueConstraint("user_id", "region_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    region_id: Mapped[str] = mapped_column(ForeignKey("regions.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReviewComment(Base):
    """평가(리뷰)에 다는 댓글. 로그인한 회원만 작성 가능하고, 대댓글은 1단계까지만 허용한다
    (parent_id 가 있는 댓글에는 또 대댓글을 달 수 없음 — API 레벨에서 검사).

    삭제는 항상 소프트 삭제(is_removed)다. 하드 삭제하면 그 댓글에 달린 대댓글들이
    고아가 되므로, 본인 삭제든 관리자 삭제든 본문만 "삭제된 댓글입니다"로 가리고 행은 남긴다.
    실제 조치자·사유는 감사 로그(audit_logs)에 남는다."""

    __tablename__ = "review_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(ForeignKey("reviews.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("review_comments.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    is_removed: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReviewVote(Base):
    """평가 추천/비추천. 회원 1인당 평가 1건에 1표(갱신 가능, value=0 요청 시 행을 삭제)."""

    __tablename__ = "review_votes"
    __table_args__ = (UniqueConstraint("review_id", "user_id"), _vote_check())

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(ForeignKey("reviews.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    value: Mapped[int] = mapped_column(SmallInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Post(Base):
    """평가(리뷰)와는 별개의 자유게시판 글. 작성 즉시 공개되고(사전 검수 없음), 금칙어만
    서버에서 걸러낸다. 문제가 생기면 작성자 본인 또는 관리자가 지운다(소프트 삭제)."""

    __tablename__ = "posts"

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    region_id: Mapped[str] = mapped_column(ForeignKey("regions.id"), index=True)
    station_id: Mapped[int | None] = mapped_column(ForeignKey("stations.id"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    body: Mapped[str] = mapped_column(Text)
    is_removed: Mapped[bool] = mapped_column(default=False, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    region: Mapped[Region] = relationship()
    station: Mapped[Station | None] = relationship()


class PostComment(Base):
    """게시판 글의 댓글. ReviewComment 와 동일한 규칙(로그인 필수, 대댓글 1단계, 소프트 삭제)."""

    __tablename__ = "post_comments"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("post_comments.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    is_removed: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PostVote(Base):
    """게시판 글 추천/비추천. ReviewVote 와 동일한 규칙."""

    __tablename__ = "post_votes"
    __table_args__ = (UniqueConstraint("post_id", "user_id"), _vote_check())

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    value: Mapped[int] = mapped_column(SmallInteger)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ReviewScrap(Base):
    """평가 스크랩(나중에 다시 보려고 저장) — 추천과 달리 찬반 의미가 없는 단순 저장 표시."""

    __tablename__ = "review_scraps"
    __table_args__ = (UniqueConstraint("review_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(ForeignKey("reviews.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PostScrap(Base):
    """게시판 글 스크랩. ReviewScrap 과 동일한 규칙."""

    __tablename__ = "post_scraps"
    __table_args__ = (UniqueConstraint("post_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    post_id: Mapped[int] = mapped_column(ForeignKey("posts.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
