"""광고 노출·클릭 집계, 광고·제휴 문의(공개) + 광고·문의 관리(관리자). 규칙은 app/models/ads.py 참고."""
import random
from datetime import date, datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, Query, UploadFile, status
from fastapi.responses import RedirectResponse
from sqlalchemy import func, or_, select, update
from sqlalchemy.orm import Session, joinedload

from app.api.v1._present import iso
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import require_admin
from app.core.rate_limit import ad_click_limiter, ad_limiter, inquiry_limiter
from app.models import INQUIRY_TYPE_LABELS, Ad, AdInquiry, InquiryStatus, Region, Station, User
from app.schemas.ads import (
    AdminAdOut, AdminInquiryOut, AdOut, AdUpdate, InquiryCreate, InquiryDoneIn, InquiryReceipt,
)
from app.schemas.public import Page
from app.services.ad_images import delete_ad_image, save_ad_image
from app.services.audit import log_action
from app.services.mailer import send_notification

router = APIRouter(tags=["ads"])
admin_router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

UPLOAD_URL = f"{settings.API_V1_PREFIX}/uploads/ads"


def _img(name: str | None) -> str | None:
    return f"{UPLOAD_URL}/{name}" if name else None


def _live_filter(today: date):
    return (
        Ad.is_active.is_(True),
        or_(Ad.starts_on.is_(None), Ad.starts_on <= today),
        or_(Ad.ends_on.is_(None), Ad.ends_on >= today),
    )


@router.get("/ads", response_model=list[AdOut], dependencies=[Depends(ad_limiter)])
def list_ads(
    region_id: str | None = None, station_id: int | None = None,
    slot: str = Query("wide", pattern="^(wide|side)$"), limit: int = Query(2, ge=1, le=4),
    db: Session = Depends(get_db),
):
    """페이지에 띄울 광고. 지역(또는 경찰서 → 그 지역)이 주어지면 그 지역 광고를 먼저, 모자라면 전국 광고로
    채운다. 같은 조건의 광고가 여러 개면 무작위로 돌려 노출한다. 여기서 내려준 광고는 노출 1회로 센다."""
    if station_id and not region_id:
        region_id = db.scalar(select(Station.region_id).where(Station.id == station_id))
    today = date.today()
    base = select(Ad).options(joinedload(Ad.region)).where(*_live_filter(today))
    if slot == "side":
        base = base.where(Ad.image_side.is_not(None))
    picked: list[Ad] = []
    if region_id:
        local = list(db.scalars(base.where(Ad.region_id == region_id)).all())
        random.shuffle(local)
        picked = local[:limit]
    if len(picked) < limit:
        national = list(db.scalars(base.where(Ad.region_id.is_(None))).all())
        random.shuffle(national)
        picked += national[: limit - len(picked)]
    if picked:
        db.execute(update(Ad).where(Ad.id.in_([a.id for a in picked])).values(impressions=Ad.impressions + 1))
        db.commit()
    return [
        AdOut(
            id=a.id, title=a.title, advertiser=a.advertiser, image_wide_url=_img(a.image_wide),
            image_side_url=_img(a.image_side), click_url=f"{settings.API_V1_PREFIX}/ads/{a.id}/click",
            region_name=a.region.name if a.region else None,
        )
        for a in picked
    ]


@router.get("/ads/{ad_id}/click", dependencies=[Depends(ad_click_limiter)])
def click_ad(ad_id: int, db: Session = Depends(get_db)):
    """클릭 수를 세고 광고주 링크로 보낸다. 링크는 관리자가 등록할 때 http(s)만 허용한다.
    내렸거나 기간이 끝난 광고는 보내지 않는다(문제 있는 링크라 내린 경우에도 계속 열리던 문제)."""
    a = db.scalar(select(Ad).where(Ad.id == ad_id, *_live_filter(date.today())))
    if not a:
        raise HTTPException(404, "광고를 찾을 수 없습니다.")
    db.execute(update(Ad).where(Ad.id == ad_id).values(clicks=Ad.clicks + 1))
    db.commit()
    return RedirectResponse(a.link_url, status_code=302)


@router.post("/ad-inquiries", response_model=InquiryReceipt, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(inquiry_limiter)])
def create_inquiry(body: InquiryCreate, background: BackgroundTasks, db: Session = Depends(get_db)):
    q = AdInquiry(
        inquiry_type=body.inquiry_type, company=body.company, name=body.name, contact=body.contact,
        region_interest=body.region_interest, message=body.message,
    )
    db.add(q)
    db.commit()
    label = INQUIRY_TYPE_LABELS[q.inquiry_type]
    background.add_task(
        send_notification,
        f"[폴리스맵] 새 {label} — {q.company}",
        f"유형: {label}\n회사/단체: {q.company}\n담당자: {q.name}\n연락처: {q.contact}\n"
        f"관심 지역: {q.region_interest or '-'}\n\n{q.message}\n\n관리자 콘솔 > 광고·제휴 문의에서 확인하세요.",
    )
    return InquiryReceipt(id=q.id, message="문의가 접수되었습니다. 남겨주신 연락처로 답변드리겠습니다.")


# ---------- 관리자 ----------
def _check_link(url: str) -> str:
    url = url.strip()
    if not url.startswith(("https://", "http://")):
        raise HTTPException(422, "광고 링크는 http:// 또는 https:// 로 시작해야 합니다.")
    return url


def _admin_ad(a: Ad, today: date) -> AdminAdOut:
    live = a.is_active and (a.starts_on is None or a.starts_on <= today) and (a.ends_on is None or a.ends_on >= today)
    return AdminAdOut(
        id=a.id, title=a.title, advertiser=a.advertiser, link_url=a.link_url, region_id=a.region_id,
        region_name=a.region.name if a.region else None, image_wide_url=_img(a.image_wide),
        image_side_url=_img(a.image_side), starts_on=a.starts_on, ends_on=a.ends_on, is_active=a.is_active,
        is_live=live, impressions=a.impressions, clicks=a.clicks,
    )


@admin_router.get("/ads", response_model=list[AdminAdOut])
def admin_list_ads(db: Session = Depends(get_db)):
    today = date.today()
    return [_admin_ad(a, today) for a in db.scalars(select(Ad).options(joinedload(Ad.region)).order_by(Ad.id.desc())).all()]


@admin_router.post("/ads", response_model=AdminAdOut, status_code=status.HTTP_201_CREATED)
def admin_create_ad(
    title: str = Form(..., max_length=100), advertiser: str = Form(..., max_length=100),
    link_url: str = Form(..., max_length=500), region_id: str | None = Form(None),
    starts_on: date | None = Form(None), ends_on: date | None = Form(None),
    image_wide: UploadFile = File(...), image_side: UploadFile | None = File(None),
    admin: User = Depends(require_admin), db: Session = Depends(get_db),
):
    region_id = region_id or None
    if region_id and not db.get(Region, region_id):
        raise HTTPException(404, "지역을 찾을 수 없습니다.")
    if starts_on and ends_on and ends_on < starts_on:
        raise HTTPException(422, "종료일이 시작일보다 빠릅니다.")
    link = _check_link(link_url)
    wide = save_ad_image(image_wide, "wide")
    side = save_ad_image(image_side, "side") if image_side and image_side.filename else None
    a = Ad(title=title.strip(), advertiser=advertiser.strip(), link_url=link, region_id=region_id,
           image_wide=wide, image_side=side, starts_on=starts_on, ends_on=ends_on)
    db.add(a)
    db.flush()
    log_action(db, admin.id, "ad.create", "ad", a.id, {"advertiser": a.advertiser, "region_id": region_id})
    db.commit()
    db.refresh(a)
    return _admin_ad(a, date.today())


@admin_router.patch("/ads/{ad_id}", response_model=AdminAdOut)
def admin_update_ad(ad_id: int, body: AdUpdate, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    a = db.get(Ad, ad_id)
    if not a:
        raise HTTPException(404, "광고를 찾을 수 없습니다.")
    data = body.model_dump(exclude_unset=True)
    for k in ("title", "advertiser", "link_url", "is_active"):
        if k in data and data[k] is None:
            raise HTTPException(422, f"{k} 는 비울 수 없습니다.")
    if "link_url" in data:
        data["link_url"] = _check_link(data["link_url"])
    starts, ends = data.get("starts_on", a.starts_on), data.get("ends_on", a.ends_on)
    if starts and ends and ends < starts:
        raise HTTPException(422, "종료일이 시작일보다 빠릅니다.")
    for k, v in data.items():
        setattr(a, k, v)
    log_action(db, admin.id, "ad.update", "ad", a.id, {k: str(v) for k, v in data.items()})
    db.commit()
    return _admin_ad(a, date.today())


@admin_router.put("/ads/{ad_id}", response_model=AdminAdOut)
def admin_edit_ad(
    ad_id: int,
    title: str = Form(..., max_length=100), advertiser: str = Form(..., max_length=100),
    link_url: str = Form(..., max_length=500), region_id: str | None = Form(None),
    starts_on: date | None = Form(None), ends_on: date | None = Form(None),
    image_wide: UploadFile | None = File(None), image_side: UploadFile | None = File(None),
    remove_side: bool = Form(False),
    admin: User = Depends(require_admin), db: Session = Depends(get_db),
):
    """관리자 화면의 "수정". 등록 폼과 같은 항목을 통째로 바꾼다(비워 보낸 지역·기간은 전국·무기한으로).
    배너 이미지는 새 파일을 올린 것만 교체하고, 세로 배너는 remove_side 로 뺄 수 있다.
    노출 수·클릭 수와 중지 여부는 그대로 둔다(중지·재개는 PATCH 로)."""
    a = db.get(Ad, ad_id)
    if not a:
        raise HTTPException(404, "광고를 찾을 수 없습니다.")
    region_id = region_id or None
    if region_id and not db.get(Region, region_id):
        raise HTTPException(404, "지역을 찾을 수 없습니다.")
    if starts_on and ends_on and ends_on < starts_on:
        raise HTTPException(422, "종료일이 시작일보다 빠릅니다.")
    link = _check_link(link_url)
    old_files: list[str | None] = []
    if image_wide and image_wide.filename:
        old_files.append(a.image_wide)
        a.image_wide = save_ad_image(image_wide, "wide")
    if image_side and image_side.filename:
        old_files.append(a.image_side)
        a.image_side = save_ad_image(image_side, "side")
    elif remove_side and a.image_side:
        old_files.append(a.image_side)
        a.image_side = None
    a.title, a.advertiser, a.link_url, a.region_id = title.strip(), advertiser.strip(), link, region_id
    a.starts_on, a.ends_on = starts_on, ends_on
    log_action(db, admin.id, "ad.edit", "ad", a.id, {
        "region_id": region_id, "images_replaced": len(old_files), "starts_on": str(starts_on), "ends_on": str(ends_on),
    })
    db.commit()
    for f in old_files:  # 저장이 끝난 뒤에 예전 파일을 지운다(중간에 실패하면 예전 배너가 그대로 남도록)
        delete_ad_image(f)
    db.refresh(a)
    return _admin_ad(a, date.today())


@admin_router.delete("/ads/{ad_id}", status_code=status.HTTP_204_NO_CONTENT)
def admin_delete_ad(ad_id: int, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    a = db.get(Ad, ad_id)
    if not a:
        raise HTTPException(404, "광고를 찾을 수 없습니다.")
    files = (a.image_wide, a.image_side)
    log_action(db, admin.id, "ad.delete", "ad", a.id, {"advertiser": a.advertiser})
    db.delete(a)
    db.commit()
    for f in files:
        delete_ad_image(f)


@admin_router.get("/inquiries", response_model=Page[AdminInquiryOut])
def admin_list_inquiries(
    status_: InquiryStatus = Query(InquiryStatus.new, alias="status"),
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=100), db: Session = Depends(get_db),
):
    base = select(AdInquiry).where(AdInquiry.status == status_)
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    rows = db.scalars(base.order_by(AdInquiry.created_at.desc(), AdInquiry.id.desc()).offset((page - 1) * size).limit(size)).all()
    return Page(items=[
        AdminInquiryOut(
            id=q.id, inquiry_type=q.inquiry_type.value, inquiry_type_label=INQUIRY_TYPE_LABELS[q.inquiry_type],
            company=q.company, name=q.name, contact=q.contact, region_interest=q.region_interest, message=q.message,
            status=q.status.value, admin_note=q.admin_note, created_at=iso(q.created_at),
        ) for q in rows
    ], total=total, page=page, size=size)


@admin_router.post("/inquiries/{inquiry_id}/done", status_code=status.HTTP_204_NO_CONTENT)
def admin_inquiry_done(inquiry_id: int, body: InquiryDoneIn, admin: User = Depends(require_admin), db: Session = Depends(get_db)):
    q = db.get(AdInquiry, inquiry_id)
    if not q:
        raise HTTPException(404, "문의를 찾을 수 없습니다.")
    q.status, q.admin_note, q.done_at = InquiryStatus.done, (body.note or "").strip() or None, datetime.now(timezone.utc)
    log_action(db, admin.id, "inquiry.done", "ad_inquiry", q.id, {})
    db.commit()
