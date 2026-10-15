import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    CheckConstraint, DateTime, Enum, ForeignKey, Index, SmallInteger, String, Text, UniqueConstraint, func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.geo import Department, Station


class ReviewRole(str, enum.Enum):
    complainant = "complainant"
    victim = "victim"
    suspect = "suspect"
    witness = "witness"
    lawyer = "lawyer"
    other = "other"  # 직접입력 — role_other 에 실제 입력값을 담는다.


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
    ReviewRole.other: "기타",
}
CASE_TYPE_LABELS = {
    CaseType.fraud: "사기(경제)",
    CaseType.assault: "폭행·상해",
    CaseType.cyber: "사이버 범죄",
    CaseType.sexual: "성범죄",
    CaseType.traffic: "교통",
    CaseType.other: "기타",
}


def role_label(r: "Review") -> str:
    """역할 라벨. '직접입력'으로 role_other 를 채워 넣은 경우 그 값을 우선 쓰고,
    비워 뒀으면 '기타'로 폴백한다."""
    return r.role_other if r.role == ReviewRole.other and r.role_other else ROLE_LABELS[r.role]


def case_type_label(r: "Review") -> str:
    return r.case_type_other if r.case_type == CaseType.other and r.case_type_other else CASE_TYPE_LABELS[r.case_type]


class ReviewStatus(str, enum.Enum):
    # 2026-10 결정: 신규 제출은 더 이상 이 상태를 거치지 않고 바로 published 된다(아래 Review
    # 클래스 docstring 참고). 이 값은 그 결정 이전부터 쌓여 있던 검수 대기열을 마저 처리하기
    # 위해서만 남겨 둔다 — 새 코드에서 이 상태로 평가를 만들지 말 것.
    pending = "pending"
    published = "published"
    rejected = "rejected"  # 검수 반려(사유 필수) — 레거시 대기열 전용
    blinded = "blinded"  # 삭제·정정 요청으로 인한 임시조치
    removed = "removed"  # 삭제 확정(관리자 사후조치 또는 당사자 요청 처리 결과)


def _rating(name: str) -> Mapped[int | None]:
    return mapped_column(SmallInteger, nullable=True, comment=name)


class Review(Base):
    """평가는 경찰서 단위로 받는다(2026-09 의뢰인 결정 — 수사관 개인 단위는 추후 별도 기능으로 재도입).

    작성은 로그인 없이도 익명으로 받는다(로그인 안 해도 그대로 가능). 로그인한 상태로 제출하면
    author_id 가 채워져 본인 계정의 "내가 쓴 글"에서 조회·댓글·추천 대상이 되지만, 공개 화면에는
    어느 경우든 작성자 신원이 드러나지 않는다(역할 라벨만 노출).

    2026-10 결정: 사전 검수를 없애고 제출 즉시 게시한다(게시판과 동일한 방식 — 익명 게시판 다수가
    이미 그렇듯, 명예훼손 등 게시물 책임은 작성자 본인이 지고 운영자는 사후에 조치한다). 사전 검수가
    "편집 행위"로 비춰져 운영자 책임이 오히려 커진다는 판단과, 검수 지연·운영 부담을 줄이려는 목적.
    금칙어 자동 필터는 그대로 1차 방어선으로 남고, 문제 게시물은 관리자가 사후 삭제(removed)하거나
    당사자가 삭제·정정 요청(TakedownRequest)을 넣으면 임시조치(blinded)된다. 이 결정 이전에 쌓여 있던
    검수 대기열은 관리자가 기존 방식(approve/reject)대로 마저 처리한다 — 그래서 pending/rejected
    상태와 그 처리 엔드포인트는 당분간 남겨 둔다.
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
        # 경찰서 상세 페이지가 매번 날리는 "이 경찰서의 공개된 평가를 최신순으로" 쿼리
        # (station_id = ? AND status = 'published' ORDER BY published_at DESC) 전용 복합 인덱스.
        # 단일 컬럼 인덱스 3개로는 비트맵 AND 가 필요해 덜 효율적이다.
        Index("ix_reviews_station_status_published", "station_id", "status", "published_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    station_id: Mapped[int] = mapped_column(ForeignKey("stations.id"), index=True)
    # 로그인 상태로 제출한 경우에만 채워진다(비로그인 제출은 NULL). 위 클래스 docstring 참고.
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))

    role: Mapped[ReviewRole] = mapped_column(Enum(ReviewRole, native_enum=False, length=20))
    case_type: Mapped[CaseType] = mapped_column(Enum(CaseType, native_enum=False, length=20))
    # role/case_type 이 '기타(직접입력)'일 때만 채워지는 자유 입력 라벨. 공개 화면에 그대로
    # 노출되므로(위 role_label/case_type_label 참고) 다른 서술형 필드와 동일하게 금칙어 필터를 거친다.
    role_other: Mapped[str | None] = mapped_column(String(40))
    case_type_other: Mapped[str | None] = mapped_column(String(40))
    # 평가 대상(2026-10 의뢰인 결정: 경찰서 전체 / 특정 부서 / 특정 수사관). 둘 다 비면 경찰서 전체 평가.
    # 부서·수사관은 반드시 station_id 와 같은 경찰서 소속이어야 한다(작성 API 에서 검증).
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id"), index=True)
    officer_id: Mapped[int | None] = mapped_column(ForeignKey("officers.id"), index=True)

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

    # DB 레벨 기본값은 일부러 fail-closed 로 pending 을 둔다(상태를 명시하지 않고 실수로 끼워 넣는
    # 코드가 생기더라도 바로 공개되지 않도록). 실제로 신규 제출 경로(reviews.py create_review)는
    # 항상 명시적으로 published 를 넣는다.
    status: Mapped[ReviewStatus] = mapped_column(
        Enum(ReviewStatus, native_enum=False, length=20), default=ReviewStatus.pending, index=True
    )
    reject_reason: Mapped[str | None] = mapped_column(String(500))  # 레거시 반려 사유 + 관리자 사후삭제 사유 공용
    # 임시조치(blinded) 직전 상태 — 재검토 후 게시 유지 결정 시 복원한다.
    blinded_from_status: Mapped[ReviewStatus | None] = mapped_column(Enum(ReviewStatus, native_enum=False, length=20))
    # 블라인드 사유(신고 누적 자동 / 관리자 수동 / 삭제·정정 요청 임시조치) — 작성자 마이페이지에 표시.
    blind_reason: Mapped[str | None] = mapped_column(String(200))
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # 작성자가 직접 적는 "증빙이 있다"는 메모(실제 서류 첨부 기능은 아직 없음 — 운영자가 확인 후
    # evidence_verified 를 켜면 공개 화면에 "증빙확인" 배지가 붙는다).
    evidence_note: Mapped[str | None] = mapped_column(String(300))
    evidence_verified: Mapped[bool] = mapped_column(default=False)
    evidence_verified_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    evidence_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    station: Mapped[Station] = relationship()
    department: Mapped[Department | None] = relationship()
    officer: Mapped[Optional["Officer"]] = relationship("Officer")  # noqa: F821 (순환 import 회피용 문자열 참조)
