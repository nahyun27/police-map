"""사건 공론화 — 이용자가 수사 과정에서 겪은 일을 기록하고, 다른 이용자가 공감·공유하는 공간.

2026-10 의뢰인 결정:
- 사전 검토 없이 작성 즉시 공개한다. 단, 개인정보·실명 노출 위험이 자동 탐지된 글은 공개하지
  않고 보류(held)해서 관리자가 확인한 뒤 공개한다(app/services/case_risk.py).
- 작성·공감·신고는 로그인 필수, 열람·공유는 비회원도 가능.
- 공감은 회원당 사건별 1회. 댓글은 초기에 제공하지 않는다(신상 추측·집단 공격 위험).
- 신고 누적(기본 5건) 시 자동 블라인드, 심각한 경우 관리자가 즉시 수동 블라인드
  (app/services/blinding.py — 평가·게시글과 같은 규칙).
- 언론·감독기관 직접 전달 기능은 없다. 기존 권리구제·제보 안내 페이지로만 연결한다.
- 작성자는 이후 민원 처리 결과·진행 상황을 업데이트로 덧붙일 수 있다(작성자 진술로 표시).

폴리스맵은 사건의 진실이나 위법성을 판정하지 않는다 — 공개는 "게시 기준 충족"일 뿐 사실 확인이
아니라는 점을 화면에서도 항상 구분해 보여준다."""
import enum
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.geo import Station


class CaseCategory(str, enum.Enum):
    delay = "delay"
    procedure = "procedure"
    evidence = "evidence"
    attitude = "attitude"
    other = "other"


CASE_CATEGORY_LABELS = {
    CaseCategory.delay: "수사 지연",
    CaseCategory.procedure: "조사 절차",
    CaseCategory.evidence: "증거 처리",
    CaseCategory.attitude: "응대 문제",
    CaseCategory.other: "기타",
}


class CaseStatus(str, enum.Enum):
    published = "published"
    held = "held"  # 개인정보·실명 노출 위험 자동 탐지 → 관리자 확인 전까지 비공개
    blinded = "blinded"  # 신고 누적 자동 / 관리자 수동 / 삭제·정정 요청 임시조치
    removed = "removed"  # 삭제(작성자 본인 또는 관리자)


class PublicCase(Base):
    __tablename__ = "public_cases"

    id: Mapped[int] = mapped_column(primary_key=True)
    author_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    station_id: Mapped[int | None] = mapped_column(ForeignKey("stations.id"), index=True)
    category: Mapped[CaseCategory] = mapped_column(Enum(CaseCategory, native_enum=False, length=20), index=True)
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(Text)  # 어떤 일이 있었나요
    desired_action: Mapped[str | None] = mapped_column(Text)  # 어떤 조치를 원하시나요(선택)

    status: Mapped[CaseStatus] = mapped_column(
        Enum(CaseStatus, native_enum=False, length=20), default=CaseStatus.published, index=True
    )
    hold_reason: Mapped[str | None] = mapped_column(String(300))  # 자동 탐지된 위험 항목 요약(관리자·작성자용)
    blinded_from_status: Mapped[CaseStatus | None] = mapped_column(Enum(CaseStatus, native_enum=False, length=20))
    blind_reason: Mapped[str | None] = mapped_column(String(200))
    blinded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    removed_reason: Mapped[str | None] = mapped_column(String(300))

    view_count: Mapped[int] = mapped_column(default=0, server_default="0")
    # 공감 수 캐시(정렬용). 화면 숫자도 이 값을 쓴다 — 공감 토글 때마다 같은 트랜잭션에서 갱신.
    empathy_count: Mapped[int] = mapped_column(default=0, server_default="0", index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    station: Mapped[Station | None] = relationship()
    updates: Mapped[list["PublicCaseUpdate"]] = relationship(
        back_populates="case", order_by="PublicCaseUpdate.created_at", cascade="all, delete-orphan"
    )


class PublicCaseEmpathy(Base):
    """공감 — 회원당 사건별 1회(취소 가능). 사실 인정·법적 동의를 뜻하지 않는다."""

    __tablename__ = "public_case_empathies"
    __table_args__ = (UniqueConstraint("case_id", "user_id"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("public_cases.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PublicCaseUpdate(Base):
    """작성자가 덧붙이는 진행 상황(민원 접수, 기관 답변 등). 모두 작성자 진술로 표시하며
    폴리스맵이 그 내용을 확인했다는 뜻이 아니다."""

    __tablename__ = "public_case_updates"

    id: Mapped[int] = mapped_column(primary_key=True)
    case_id: Mapped[int] = mapped_column(ForeignKey("public_cases.id"), index=True)
    body: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    case: Mapped[PublicCase] = relationship(back_populates="updates")
