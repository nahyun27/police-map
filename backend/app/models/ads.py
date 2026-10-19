"""광고·제휴 — 2026-10 의뢰인 요청(수익화).

- 광고는 관리자가 직접 등록한다(이미지 업로드 + 링크 + 노출 기간 + 대상 지역). 결제·계약은 사이트 밖에서
  하고, 여기서는 "무엇을 어디에 언제까지 띄울지"만 관리한다.
- 대상 지역(region_id)이 있으면 그 지역 페이지·그 지역 경찰서 페이지에, 없으면(전국) 홈·커뮤니티 등
  일반 페이지와 지역 광고가 없는 지역 페이지에 노출한다.
- 모든 광고는 화면에 "광고"로 표시하고, 평가·순위 등 콘텐츠에는 어떤 영향도 주지 않는다(운영원칙 중립성).
- 이미지 두 종: 가로형(본문 하단·권리구제 광고란·모바일)은 필수, 세로형(넓은 PC 화면 양옆)은 선택.
"""
import enum
from datetime import date, datetime

from sqlalchemy import Date, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base
from app.models.geo import Region


class Ad(Base):
    __tablename__ = "ads"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(100))  # 관리용 이름(화면에는 alt 로만 쓰임)
    advertiser: Mapped[str] = mapped_column(String(100))
    link_url: Mapped[str] = mapped_column(String(500))
    region_id: Mapped[str | None] = mapped_column(ForeignKey("regions.id"), index=True)  # None = 전국
    image_wide: Mapped[str] = mapped_column(String(200))  # 업로드 파일명(uploads/ads/ 아래)
    image_side: Mapped[str | None] = mapped_column(String(200))
    starts_on: Mapped[date | None] = mapped_column(Date)
    ends_on: Mapped[date | None] = mapped_column(Date)
    is_active: Mapped[bool] = mapped_column(default=True, index=True)
    impressions: Mapped[int] = mapped_column(default=0, server_default="0")
    clicks: Mapped[int] = mapped_column(default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    region: Mapped[Region | None] = relationship()


class InquiryType(str, enum.Enum):
    ad = "ad"
    partnership = "partnership"
    other = "other"


INQUIRY_TYPE_LABELS = {InquiryType.ad: "광고 문의", InquiryType.partnership: "제휴·비즈니스", InquiryType.other: "기타"}


class InquiryStatus(str, enum.Enum):
    new = "new"
    done = "done"


class AdInquiry(Base):
    """광고·제휴 문의. 비로그인으로도 접수(광고주는 회원이 아닐 수 있음). 연락처는 관리자에게만 보인다."""

    __tablename__ = "ad_inquiries"

    id: Mapped[int] = mapped_column(primary_key=True)
    inquiry_type: Mapped[InquiryType] = mapped_column(Enum(InquiryType, native_enum=False, length=20))
    company: Mapped[str] = mapped_column(String(100))
    name: Mapped[str] = mapped_column(String(50))
    contact: Mapped[str] = mapped_column(String(100))
    region_interest: Mapped[str | None] = mapped_column(String(50))
    message: Mapped[str] = mapped_column(Text)
    status: Mapped[InquiryStatus] = mapped_column(
        Enum(InquiryStatus, native_enum=False, length=20), default=InquiryStatus.new, index=True
    )
    admin_note: Mapped[str | None] = mapped_column(String(500))
    # 처리 완료 시각. 이로부터 1년이 지나면 문의를 파기한다(개인정보처리방침 보관 기간, services/retention.py).
    done_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
