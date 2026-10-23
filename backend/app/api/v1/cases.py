"""사건 공론화 API — 운영 규칙은 app/models/public_case.py docstring 참고."""
import hashlib
import hmac

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.api.v1._present import iso
from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_client_ip_hash, get_current_user, get_current_user_optional
from app.core.moderation import find_banned
from app.core.rate_limit import case_limiter, comment_limiter, empathy_limiter, view_limiter
from app.models import (
    CASE_CATEGORY_LABELS, CaseCategory, CaseStatus, PublicCase, PublicCaseEmpathy, PublicCaseUpdate, Station, User,
    UserRole,
)
from app.schemas.public import Page
from app.schemas.public_case import (
    CaseCard, CaseCreate, CaseDetail, CaseReceipt, CaseUpdateCreate, CaseUpdateOut, EmpathyOut, MyCaseOut,
)
from app.services import case_risk
from app.services.audit import log_action
from app.services.names import mask_station_officers
from app.services.takedown import utcnow

router = APIRouter(prefix="/cases", tags=["cases"])


def _update_counts(db: Session, ids: list[int]) -> dict[int, int]:
    if not ids:
        return {}
    rows = db.execute(
        select(PublicCaseUpdate.case_id, func.count(PublicCaseUpdate.id))
        .where(PublicCaseUpdate.case_id.in_(ids)).group_by(PublicCaseUpdate.case_id)
    ).all()
    return dict(rows)


def _anon_empathy_key(request: Request) -> str:
    """비회원 공감자 식별값. IP 만 쓰면 같은 회사·학교·통신사 공유 IP 뒤의 여러 사람이 한 사람으로 묶여, 남이 한
    공감이 내 것으로 보이고 취소까지 되던 문제(2026-10 점검)가 있어 브라우저 정보(User-Agent)를 함께 섞는다.
    쿠키는 쓰지 않는다(개인정보처리방침: 로그인 유지용 쿠키만 사용). 원래 값은 저장하지 않는 HMAC 해시다."""
    ua = request.headers.get("user-agent", "")[:300]
    digest = hmac.new(settings.JWT_SECRET_KEY.encode(), f"case-empathy:{get_client_ip_hash(request)}|{ua}".encode(), hashlib.sha256)
    return digest.hexdigest()[:32]


def _empathizer(request: Request, user: User | None):
    """공감한 사람을 찾는 조건. 회원은 계정, 비회원은 IP+브라우저 해시."""
    return PublicCaseEmpathy.user_id == user.id if user else PublicCaseEmpathy.ip_hash == _anon_empathy_key(request)


def _my_empathies(db: Session, ids: list[int], request: Request, user: User | None) -> set[int]:
    if not ids:
        return set()
    return set(db.scalars(
        select(PublicCaseEmpathy.case_id).where(_empathizer(request, user), PublicCaseEmpathy.case_id.in_(ids))
    ))


def _card(c: PublicCase, update_count: int, my_empathy: bool) -> CaseCard:
    excerpt = c.body[:140] + ("…" if len(c.body) > 140 else "")
    return CaseCard(
        id=c.id, category=c.category.value, category_label=CASE_CATEGORY_LABELS[c.category], title=c.title,
        excerpt=excerpt, station_id=c.station_id, station_name=c.station.name if c.station else None,
        empathy_count=c.empathy_count, view_count=c.view_count, update_count=update_count,
        created_at=iso(c.created_at), my_empathy=my_empathy,
    )


@router.get("", response_model=Page[CaseCard])
def list_cases(
    request: Request,
    category: CaseCategory | None = None,
    q: str | None = Query(None, max_length=50),
    sort: str = Query("new", pattern="^(new|empathy)$"),
    page: int = Query(1, ge=1), size: int = Query(20, ge=1, le=50),
    db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional),
):
    """공개된 사건만. 기본은 최신순 — 공감순만 기본값으로 두면 자극적인 글만 위로 올라오기 쉽다."""
    base = select(PublicCase).where(PublicCase.status == CaseStatus.published)
    if category:
        base = base.where(PublicCase.category == category)
    if qq := (q.strip() if q else None):
        base = base.where(PublicCase.title.contains(qq, autoescape=True) | PublicCase.body.contains(qq, autoescape=True))
    total = db.scalar(select(func.count()).select_from(base.subquery())) or 0
    order = (
        (PublicCase.empathy_count.desc(), PublicCase.created_at.desc(), PublicCase.id.desc()) if sort == "empathy"
        else (PublicCase.created_at.desc(), PublicCase.id.desc())
    )
    rows = db.scalars(
        base.options(joinedload(PublicCase.station)).order_by(*order).offset((page - 1) * size).limit(size)
    ).all()
    ids = [c.id for c in rows]
    counts, mine = _update_counts(db, ids), _my_empathies(db, ids, request, user)
    return Page(items=[_card(c, counts.get(c.id, 0), c.id in mine) for c in rows], total=total, page=page, size=size)


@router.get("/mine", response_model=list[MyCaseOut])
def list_my_cases(db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """작성자 본인의 사건 — 보류·블라인드·삭제 상태와 사유까지 보여준다."""
    rows = db.scalars(
        select(PublicCase).where(PublicCase.author_id == user.id).order_by(PublicCase.created_at.desc(), PublicCase.id.desc())
    ).all()
    return [
        MyCaseOut(
            id=c.id, title=c.title, category_label=CASE_CATEGORY_LABELS[c.category], status=c.status.value,
            hold_reason=c.hold_reason, blind_reason=c.blind_reason, removed_reason=c.removed_reason,
            empathy_count=c.empathy_count, created_at=iso(c.created_at),
        )
        for c in rows
    ]


def _visible_or_404(db: Session, case_id: int, user: User | None) -> tuple[PublicCase, bool]:
    """(사건, 작성자·관리자 여부). 공개되지 않은 사건은 작성자 본인과 관리자만 볼 수 있다."""
    c = db.get(PublicCase, case_id)
    privileged = bool(c and user and (c.author_id == user.id or user.role == UserRole.admin))
    if not c or c.status == CaseStatus.removed or (c.status != CaseStatus.published and not privileged):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "사건을 찾을 수 없습니다.")
    return c, privileged


@router.get("/{case_id}", response_model=CaseDetail)
def get_case(
    case_id: int, request: Request, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional),
):
    c, privileged = _visible_or_404(db, case_id, user)
    card = _card(c, len(c.updates), c.id in _my_empathies(db, [c.id], request, user))
    return CaseDetail(
        **card.model_dump(), body=c.body, desired_action=c.desired_action,
        updates=[CaseUpdateOut(id=u.id, body=u.body, created_at=iso(u.created_at)) for u in c.updates],
        is_mine=bool(user and c.author_id == user.id), status=c.status.value,
        hold_reason=c.hold_reason if privileged else None, blind_reason=c.blind_reason if privileged else None,
    )


@router.post("/{case_id}/view", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(view_limiter)])
def increment_case_view(case_id: int, db: Session = Depends(get_db)):
    db.execute(update(PublicCase).where(PublicCase.id == case_id, PublicCase.status == CaseStatus.published)
               .values(view_count=PublicCase.view_count + 1))
    db.commit()


def _reject_unsafe(*texts: str | None) -> None:
    banned = find_banned("\n".join(t for t in texts if t))
    if banned:
        raise HTTPException(422, {"message": "게시할 수 없는 표현이 포함되어 있습니다. 사실 중심으로 수정해 주세요.", "banned": banned})


@router.post("", response_model=CaseReceipt, status_code=status.HTTP_201_CREATED, dependencies=[Depends(case_limiter)])
def create_case(body: CaseCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """작성 즉시 공개. 개인정보·실명 노출 위험이 자동 탐지되면 보류(held)하고 관리자 확인 후 공개."""
    if body.station_id is not None and not db.get(Station, body.station_id):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "경찰서를 찾을 수 없습니다.")
    body.title, body.body, body.desired_action = mask_station_officers(
        db, body.station_id, body.title, body.body, body.desired_action,
    )
    _reject_unsafe(body.title, body.body, body.desired_action)
    risks = case_risk.detect(body.title, body.body, body.desired_action)
    c = PublicCase(
        author_id=user.id, station_id=body.station_id, category=body.category, title=body.title, body=body.body,
        desired_action=body.desired_action,
        status=CaseStatus.held if risks else CaseStatus.published,
        hold_reason=f"자동 탐지: {', '.join(risks)}" if risks else None,
    )
    db.add(c)
    db.flush()
    log_action(db, user.id, "case.create", "public_case", c.id, {"status": c.status.value, "risks": risks})
    db.commit()
    if risks:
        msg = (f"개인정보 노출 가능성({', '.join(risks)})이 확인되어 운영진 확인 후 공개됩니다. "
               "해당 내용을 지우고 다시 쓰시면 바로 공개됩니다.")
    else:
        msg = "사건이 공개되었습니다."
    return CaseReceipt(id=c.id, status=c.status.value, message=msg)


@router.delete("/{case_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_case(case_id: int, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    c = db.get(PublicCase, case_id)
    if not c or c.status == CaseStatus.removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "사건을 찾을 수 없습니다.")
    if c.author_id != user.id and user.role != UserRole.admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "본인이 작성한 사건만 삭제할 수 있습니다.")
    c.status = CaseStatus.removed
    c.removed_reason = "작성자 삭제" if c.author_id == user.id else "운영진 삭제"
    log_action(db, user.id, "case.remove", "public_case", c.id, {"self": c.author_id == user.id})
    db.commit()


@router.post("/{case_id}/empathy", response_model=EmpathyOut, dependencies=[Depends(empathy_limiter)])
def add_empathy(
    case_id: int, request: Request, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional),
):
    """로그인 없이도 공감할 수 있다(2026-10). 비회원은 IP 해시당 사건별 1회."""
    c = db.get(PublicCase, case_id)
    if not c or c.status != CaseStatus.published:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "사건을 찾을 수 없습니다.")
    exists = db.scalar(select(PublicCaseEmpathy.id).where(PublicCaseEmpathy.case_id == case_id, _empathizer(request, user)))
    if not exists:
        db.add(PublicCaseEmpathy(
            case_id=case_id, user_id=user.id if user else None, ip_hash=None if user else _anon_empathy_key(request),
        ))
        # 카운터는 DB 에서 원자적으로 올린다(파이썬에서 읽고 더해 쓰면 동시 공감이 서로 덮어써 숫자가 샌다).
        db.execute(update(PublicCase).where(PublicCase.id == case_id).values(empathy_count=PublicCase.empathy_count + 1))
        try:
            db.commit()
        except IntegrityError:  # 같은 사람이 동시에 두 번 누른 경우 — 유니크 제약이 막고 카운터도 함께 롤백된다
            db.rollback()
    count = db.scalar(select(PublicCase.empathy_count).where(PublicCase.id == case_id))
    return EmpathyOut(empathized=True, empathy_count=count or 0)


@router.delete("/{case_id}/empathy", response_model=EmpathyOut, dependencies=[Depends(empathy_limiter)])
def remove_empathy(
    case_id: int, request: Request, db: Session = Depends(get_db), user: User | None = Depends(get_current_user_optional),
):
    c = db.get(PublicCase, case_id)
    if not c or c.status != CaseStatus.published:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "사건을 찾을 수 없습니다.")
    # 삭제된 행 수로 판단해야 같은 사람의 동시 취소 두 번이 카운터를 두 번 깎지 않는다.
    deleted = db.execute(
        delete(PublicCaseEmpathy).where(PublicCaseEmpathy.case_id == case_id, _empathizer(request, user))
    ).rowcount
    if deleted:
        db.execute(update(PublicCase).where(PublicCase.id == case_id, PublicCase.empathy_count > 0)
                   .values(empathy_count=PublicCase.empathy_count - 1))
    db.commit()
    count = db.scalar(select(PublicCase.empathy_count).where(PublicCase.id == case_id))
    return EmpathyOut(empathized=False, empathy_count=count or 0)


@router.post("/{case_id}/updates", response_model=CaseUpdateOut, status_code=status.HTTP_201_CREATED,
             dependencies=[Depends(comment_limiter)])
def add_case_update(case_id: int, body: CaseUpdateCreate, db: Session = Depends(get_db), user: User = Depends(get_current_user)):
    """작성자가 진행 상황(민원 접수, 기관 답변 등)을 덧붙인다. 업데이트에 개인정보가 보이면
    보류 대신 바로 거절한다(짧은 글이라 고쳐서 다시 쓰는 편이 빠르다)."""
    c = db.get(PublicCase, case_id)
    if not c or c.status == CaseStatus.removed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "사건을 찾을 수 없습니다.")
    if c.author_id != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "작성자만 진행 상황을 추가할 수 있습니다.")
    (body.body,) = mask_station_officers(db, c.station_id, body.body)
    _reject_unsafe(body.body)
    risks = case_risk.detect(body.body)
    if risks:
        raise HTTPException(422, {"message": f"개인정보로 보이는 내용({', '.join(risks)})이 있어 등록할 수 없습니다. 지우고 다시 써 주세요."})
    u = PublicCaseUpdate(case_id=c.id, body=body.body)
    db.add(u)
    c.updated_at = utcnow()
    db.commit()
    return CaseUpdateOut(id=u.id, body=u.body, created_at=iso(u.created_at))
