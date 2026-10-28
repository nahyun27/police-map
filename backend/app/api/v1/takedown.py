from datetime import timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.v1._present import iso
from app.core.database import get_db
from app.core.rate_limit import takedown_limiter
from app.models import CaseStatus, Officer, PublicCase, Review, ReviewStatus, TakedownRequest, TakedownTarget
from app.schemas.takedown import TakedownCreate, TakedownReceipt, TakedownStatusOut
from app.services import takedown as svc
from app.services.mailer import send_notification

KST = timezone(timedelta(hours=9))

router = APIRouter(prefix="/takedown-requests", tags=["takedown"])


@router.post("", response_model=TakedownReceipt, status_code=status.HTTP_201_CREATED, dependencies=[Depends(takedown_limiter)])
def create_takedown(body: TakedownCreate, background: BackgroundTasks, db: Session = Depends(get_db)):
    """당사자 삭제·정정 요청 접수. 접수 즉시 대상은 임시조치(블라인드)된다. 로그인 없이 접수 가능."""
    if body.target_type == TakedownTarget.review:
        target = db.get(Review, body.target_id)
        # 공개된(또는 이미 임시조치된) 평가만 요청 대상이 된다. 비공개 평가의 존재는 드러내지 않는다.
        if not target or target.status not in (ReviewStatus.published, ReviewStatus.blinded):
            raise HTTPException(404, "대상을 찾을 수 없습니다.")
        ids = {"review_id": target.id}
    elif body.target_type == TakedownTarget.public_case:
        target = db.get(PublicCase, body.target_id)
        if not target or target.status not in (CaseStatus.published, CaseStatus.blinded):
            raise HTTPException(404, "대상을 찾을 수 없습니다.")
        ids = {"case_id": target.id}
    else:
        target = db.get(Officer, body.target_id)
        if not target or not target.is_published:
            raise HTTPException(404, "대상을 찾을 수 없습니다.")
        ids = {"officer_id": target.id}

    req = svc.create_request(
        db, target_type=body.target_type, request_type=body.request_type, requester_name=body.requester_name,
        requester_contact=body.requester_contact, relation=body.relation, reason=body.reason, **ids,
    )
    db.commit()
    # 재검토 기한(접수 후 10일)을 놓치지 않게 운영자에게 바로 알린다. 요청인 성명·연락처·사유는 메일(외부 메일 서버)로
    # 보내지 않는다(개인정보처리방침의 국외 이전 범위 밖). 내용은 관리자 콘솔에서 본다.
    target_label = {"review": "평가", "public_case": "사건 공론화", "officer": "수사관 프로필"}[body.target_type.value]
    request_label = "삭제" if body.request_type.value == "delete" else "정정"
    due = req.due_at.astimezone(KST).strftime("%Y-%m-%d") if req.due_at.tzinfo else req.due_at.strftime("%Y-%m-%d")
    background.add_task(
        send_notification,
        f"[폴리스맵] 새 삭제·정정 요청 ({target_label} #{body.target_id})",
        f"대상: {target_label} #{body.target_id}\n요청 유형: {request_label}\n관계: {body.relation}\n"
        f"재검토 기한: {due}\n\n대상은 접수와 함께 임시조치(블라인드)되었습니다.\n"
        f"관리자 콘솔 > 삭제·정정 요청에서 원문과 사유를 확인하고 게시 유지 또는 삭제 확정으로 처리해 주세요.",
    )
    return TakedownReceipt(
        public_code=req.public_code, status=req.status.value, due_at=iso(req.due_at),
        message="요청이 접수되었고 해당 게시물은 즉시 임시조치(블라인드)되었습니다. 처리 결과는 접수 코드로 조회하실 수 있습니다.",
    )


@router.get("/{public_code}", response_model=TakedownStatusOut)
def get_takedown_status(public_code: str, db: Session = Depends(get_db)):
    req = db.scalar(select(TakedownRequest).where(TakedownRequest.public_code == public_code))
    if not req:
        raise HTTPException(404, "접수 내역을 찾을 수 없습니다.")
    return TakedownStatusOut(
        public_code=req.public_code, status=req.status.value, request_type=req.request_type.value,
        target_type=req.target_type.value, created_at=iso(req.created_at), due_at=iso(req.due_at),
        resolved_at=iso(req.resolved_at), resolution_note=req.resolution_note,
    )
