import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.user import User


class ReportTarget(str, enum.Enum):
    review = "review"
    post = "post"
    review_comment = "review_comment"
    post_comment = "post_comment"
    review_reply = "review_reply"


class ReportStatus(str, enum.Enum):
    pending = "pending"
    resolved = "resolved"


class Report(Base):
    """이용자 신고 — 평가·게시판 글·댓글·해명 어디든 신고할 수 있다. 관리자가 사후삭제로
    직접 조치하는 기존 경로와 달리, 이건 "이용자가 문제를 지적해서 큐에 올리는" 경로다.

    대상이 5종류(review/post/review_comment/post_comment/review_reply)라 TakedownRequest 처럼
    타입별 nullable FK 컬럼을 두면 너무 성글어져서, 여기서는 예외적으로 target_type + target_id
    (FK 없는 정수)로 단순화한다. 그 대신 대상 존재 여부는 API 레벨에서 검사한다 — 참조
    무결성을 DB 가 아니라 애플리케이션이 책임진다는 뜻이니, 이 모델을 건드리는 코드는
    항상 target_type 에 맞는 테이블을 직접 조회해서 유효성을 확인해야 한다."""

    __tablename__ = "reports"

    id: Mapped[int] = mapped_column(primary_key=True)
    reporter_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    target_type: Mapped[ReportTarget] = mapped_column(Enum(ReportTarget, native_enum=False, length=20), index=True)
    target_id: Mapped[int] = mapped_column(index=True)
    reason: Mapped[str] = mapped_column(String(500))

    status: Mapped[ReportStatus] = mapped_column(
        Enum(ReportStatus, native_enum=False, length=20), default=ReportStatus.pending, index=True
    )
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolution_action: Mapped[str | None] = mapped_column(String(20))  # "removed" | "dismissed"
    resolution_note: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # reporter_id/resolved_by 둘 다 users.id 를 가리켜서 모호하므로 foreign_keys 로 명시한다.
    reporter: Mapped[User] = relationship(foreign_keys=[reporter_id])
