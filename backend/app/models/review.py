import enum
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, SmallInteger, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.officer import Officer
from app.models.user import User


class ReviewRole(str, enum.Enum):
    complainant = "complainant"
    victim = "victim"
    suspect = "suspect"
    witness = "witness"
    lawyer = "lawyer"


class CaseType(str, enum.Enum):
    fraud = "fraud"
    assault = "assault"
    cyber = "cyber"
    sexual = "sexual"
    traffic = "traffic"
    other = "other"


ROLE_LABELS = {
    ReviewRole.complainant: "고소인",
    ReviewRole.victim: "피해자",
    ReviewRole.suspect: "피의자",
    ReviewRole.witness: "참고인",
    ReviewRole.lawyer: "변호인",
}
CASE_TYPE_LABELS = {
    CaseType.fraud: "사기(경제)",
    CaseType.assault: "폭행·상해",
    CaseType.cyber: "사이버 범죄",
    CaseType.sexual: "성범죄",
    CaseType.traffic: "교통",
    CaseType.other: "기타",
}


class ReviewStatus(str, enum.Enum):
    pending = "pending"  # 검수 대기 — 공개되지 않음
    published = "published"
    rejected = "rejected"  # 검수 반려(사유 필수)
    blinded = "blinded"  # 삭제·정정 요청으로 인한 임시조치
    removed = "removed"  # 삭제 확정


def _rating(name: str) -> Mapped[int | None]:
    return mapped_column(SmallInteger, nullable=True, comment=name)


class Review(Base):
    __tablename__ = "reviews"
    __table_args__ = (
        # 같은 사람이 같은 사건(해시)으로 같은 수사관을 여러 번 평가하지 못하게 한다.
        UniqueConstraint("author_id", "officer_id", "case_number_hash"),
        CheckConstraint("fair IS NULL OR fair BETWEEN 1 AND 5", name="fair_range"),
        CheckConstraint("proc IS NULL OR proc BETWEEN 1 AND 5", name="proc_range"),
        CheckConstraint("att IS NULL OR att BETWEEN 1 AND 5", name="att_range"),
        CheckConstraint("comm IS NULL OR comm BETWEEN 1 AND 5", name="comm_range"),
        CheckConstraint("speed IS NULL OR speed BETWEEN 1 AND 5", name="speed_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    officer_id: Mapped[int] = mapped_column(ForeignKey("officers.id"), index=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)

    role: Mapped[ReviewRole] = mapped_column(Enum(ReviewRole, native_enum=False, length=20))
    case_type: Mapped[CaseType] = mapped_column(Enum(CaseType, native_enum=False, length=20))

    # 사건번호는 게시하지 않고 '경험 검증'에만 쓴다. 공개 응답 스키마에 절대 포함하지 말 것.
    # TODO: 운영 배포 전 컬럼 단위 암호화(또는 KMS) 적용 검토.
    case_number: Mapped[str] = mapped_column(String(100))
    case_number_hash: Mapped[str] = mapped_column(String(64))

    fair: Mapped[int | None] = _rating("공정성")
    proc: Mapped[int | None] = _rating("절차 준수")
    att: Mapped[int | None] = _rating("조사 태도")
    comm: Mapped[int | None] = _rating("소통·응대")
    speed: Mapped[int | None] = _rating("신속성")

    body: Mapped[str] = mapped_column(Text, default="")

    status: Mapped[ReviewStatus] = mapped_column(
        Enum(ReviewStatus, native_enum=False, length=20), default=ReviewStatus.pending, index=True
    )
    reject_reason: Mapped[str | None] = mapped_column(String(500))
    # 임시조치(blinded) 직전 상태 — 재검토 후 게시 유지 결정 시 복원한다.
    blinded_from_status: Mapped[ReviewStatus | None] = mapped_column(Enum(ReviewStatus, native_enum=False, length=20))
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    officer: Mapped[Officer] = relationship()
    author: Mapped[User] = relationship(foreign_keys=[author_id])
