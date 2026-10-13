from datetime import date

from pydantic import BaseModel, Field, model_validator

from app.models import InquiryType


class AdOut(BaseModel):
    """공개용. 링크 원문 대신 클릭 집계용 리다이렉트 경로를 준다."""
    id: int
    title: str
    advertiser: str
    image_wide_url: str
    image_side_url: str | None
    click_url: str
    region_name: str | None


class AdminAdOut(BaseModel):
    id: int
    title: str
    advertiser: str
    link_url: str
    region_id: str | None
    region_name: str | None
    image_wide_url: str
    image_side_url: str | None
    starts_on: date | None
    ends_on: date | None
    is_active: bool
    is_live: bool  # 지금 실제로 노출 중인지(활성 + 기간 안)
    impressions: int
    clicks: int


class AdUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=100)
    advertiser: str | None = Field(default=None, max_length=100)
    link_url: str | None = Field(default=None, max_length=500)
    starts_on: date | None = None
    ends_on: date | None = None
    is_active: bool | None = None


class InquiryCreate(BaseModel):
    inquiry_type: InquiryType
    company: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=50)
    contact: str = Field(min_length=5, max_length=100)
    region_interest: str | None = Field(default=None, max_length=50)
    message: str = Field(min_length=10, max_length=3000)
    agreed: bool  # 개인정보(연락처) 수집·이용 동의

    @model_validator(mode="after")
    def _check(self):
        if not self.agreed:
            raise ValueError("개인정보 수집·이용에 동의해 주세요.")
        self.company, self.name, self.contact, self.message = (
            self.company.strip(), self.name.strip(), self.contact.strip(), self.message.strip()
        )
        self.region_interest = (self.region_interest or "").strip() or None
        return self


class InquiryReceipt(BaseModel):
    id: int
    message: str


class AdminInquiryOut(BaseModel):
    id: int
    inquiry_type: str
    inquiry_type_label: str
    company: str
    name: str
    contact: str
    region_interest: str | None
    message: str
    status: str
    admin_note: str | None
    created_at: str | None


class InquiryDoneIn(BaseModel):
    note: str | None = Field(default=None, max_length=500)
