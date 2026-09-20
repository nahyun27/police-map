import enum
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class TakedownTarget(str, enum.Enum):
    review = "review"
    officer = "officer"


class TakedownType(str, enum.Enum):
    delete = "delete"
    correct = "correct"


class TakedownStatus(str, enum.Enum):
    pending = "pending"  # 접수 + 임시조치(블라인드) 완료, 재검토 대기
    kept = "kept"  # 검토 결과 게시 유지(임시조치 해제)
    removed = "removed"  # 삭제 확정


class TakedownRequest(Base):
    """당사자 삭제·정정 요청. 접수 즉시 대상은 임시조치(블라인드)된다."""

    __tablename__ = "takedown_requests"
    __table_args__ = (
        CheckConstraint(
            "(review_id IS NOT NULL AND officer_id IS NULL) OR (review_id IS NULL AND officer_id IS NOT NULL)",
            name="exactly_one_target",
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    # 요청자가 처리 상태를 조회할 때 쓰는 추측 불가 코드
    public_code: Mapped[str] = mapped_column(String(32), unique=True, index=True)

    target_type: Mapped[TakedownTarget] = mapped_column(Enum(TakedownTarget, native_enum=False, length=20))
    review_id: Mapped[int | None] = mapped_column(ForeignKey("reviews.id"), index=True)
    officer_id: Mapped[int | None] = mapped_column(ForeignKey("officers.id"), index=True)

    request_type: Mapped[TakedownType] = mapped_column(Enum(TakedownType, native_enum=False, length=20))
    requester_name: Mapped[str] = mapped_column(String(50))
    requester_contact: Mapped[str] = mapped_column(String(100))  # 처리 결과 통지용. 공개 응답에 포함 금지.
    relation: Mapped[str] = mapped_column(String(30))  # 본인 / 대리인 / 기타
    reason: Mapped[str] = mapped_column(Text)

    status: Mapped[TakedownStatus] = mapped_column(
        Enum(TakedownStatus, native_enum=False, length=20), default=TakedownStatus.pending, index=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    resolution_note: Mapped[str | None] = mapped_column(Text)
