import enum
from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, Enum, ForeignKey, SmallInteger, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.geo import Station


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
    """평가는 경찰서 단위로 받는다(2026-09 의뢰인 결정 — 수사관 개인 단위는 추후 별도 기능으로 재도입).

    작성은 로그인 없이 익명으로 받는다. author_id 는 향후 회원제(과금 단계)를 위해 남겨 둔
    nullable 컬럼으로, 현재는 항상 NULL 이다 — 로그인한 회원이 남긴 평가를 나중에 그 회원과
    연결하고 싶을 때를 대비한 것일 뿐, 지금 로직은 이 값을 채우지도 참조하지도 않는다.
    """

    __tablename__ = "reviews"
    __table_args__ = (
        # 같은 경찰서에 같은 사건(해시)으로 중복 제출하지 못하게 한다. 사건번호는 선택 입력이라
        # case_number_hash 가 NULL 인 행은 여러 건이어도 충돌하지 않는다(익명 다건 제출 허용).
        UniqueConstraint("station_id", "case_number_hash"),
        CheckConstraint("fair IS NULL OR fair BETWEEN 1 AND 5", name="fair_range"),
        CheckConstraint("proc IS NULL OR proc BETWEEN 1 AND 5", name="proc_range"),
        CheckConstraint("att IS NULL OR att BETWEEN 1 AND 5", name="att_range"),
        CheckConstraint("comm IS NULL OR comm BETWEEN 1 AND 5", name="comm_range"),
        CheckConstraint("speed IS NULL OR speed BETWEEN 1 AND 5", name="speed_range"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"), index=True)
    # 현재 항상 NULL — 위 클래스 docstring 참고.
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    role: Mapped[ReviewRole] = mapped_column(Enum(ReviewRole, native_enum=False, length=20))
    case_type: Mapped[CaseType] = mapped_column(Enum(CaseType, native_enum=False, length=20))

    # 사건번호는 선택 입력이며 게시하지 않고 '경험 검증·중복 제출 방지'에만 쓴다.
    # 공개 응답 스키마에 절대 포함하지 말 것.
    # TODO: 운영 배포 전 컬럼 단위 암호화(또는 KMS) 적용 검토.
    case_number: Mapped[str | None] = mapped_column(String(100))
    case_number_hash: Mapped[str | None] = mapped_column(String(64))

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

    station: Mapped[Station] = relationship()
