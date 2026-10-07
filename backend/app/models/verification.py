import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.geo import Station
from app.models.user import User


class VerificationStatus(str, enum.Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class OfficerVerification(Base):
    """회원 계정이 실제 경찰관임을 주장하며 넣는 신원 인증 신청 — 관리자가 수동 심사한다(사진·서류
    업로드 기능은 없음, 소속 경찰서 대표번호로 확인하는 등 운영자 재량의 오프라인 확인을 전제로 함).

    승인되면 User.officer_* 컬럼에 반영되어 그 경찰서 리뷰에 해명(ReviewReply)을 달 수 있게 된다.
    한 계정이 동시에 여러 건 심사 대기시키지 못하게(API 레벨에서) pending 은 1건만 허용한다."""

    __tablename__ = "officer_verifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"), index=True)
    name: Mapped[str] = mapped_column(String(50))
    rank: Mapped[str] = mapped_column(String(30))
    department: Mapped[str | None] = mapped_column(String(100))
    # 운영자 확인용 비공개 연락처(공개 화면에 절대 노출 금지). 경찰 공식 도메인 메일이면 신뢰도가 높다.
    contact: Mapped[str] = mapped_column(String(200))
    proof_note: Mapped[str | None] = mapped_column(String(300))

    status: Mapped[VerificationStatus] = mapped_column(
        Enum(VerificationStatus, native_enum=False, length=20), default=VerificationStatus.pending, index=True
    )
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reject_reason: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    station: Mapped[Station] = relationship()
    # user_id/reviewed_by 둘 다 users.id 를 가리켜서 모호하므로 foreign_keys 로 명시한다.
    user: Mapped[User] = relationship(foreign_keys=[user_id])


class ReviewReply(Base):
    """인증된 경찰관(본인 소속 경찰서 한정)이 리뷰에 다는 공식 해명 — 리뷰 1건당 1개만 허용한다
    (여러 경찰관이 같은 리뷰에 각자 답을 다는 상황을 막기 위함 — 경찰서의 공식 입장은 하나).

    댓글(ReviewComment)과 달리 대댓글 트리가 없어 고아 행 문제가 생기지 않으므로, 삭제는
    진짜 하드 삭제로 한다(그래야 삭제 후 다른 인증된 경찰관이 다시 해명을 달 수 있다 —
    UniqueConstraint(review_id) 가 소프트 삭제된 행까지 막아버리는 걸 피하기 위함).
    조치자·사유는 삭제 전에 감사 로그로 남긴다."""

    __tablename__ = "review_replies"
    __table_args__ = (UniqueConstraint("review_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    review_id: Mapped[int] = mapped_column(ForeignKey("reviews.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    # true 면 공개 화면에 작성자 성명을 보여준다(false 면 계급·부서만). 작성자가 매번 선택.
    show_name: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
