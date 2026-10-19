from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.cookies import clear_auth_cookies, get_access_token, get_refresh_token, set_auth_cookies
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.rate_limit import delete_account_limiter, login_limiter, refresh_limiter, register_limiter
from app.core.security import (
    create_access_token, create_refresh_token, decode_token, hash_password, token_matches_user, verify_password,
)
from app.models import User
from app.schemas.auth import DeleteAccountIn, LoginIn, RegisterIn, UserOut
from app.services.account import delete_account

router = APIRouter(prefix="/auth", tags=["auth"])

# 존재하지 않는 계정에도 같은 시간이 걸리도록 하는 더미 해시(계정 존재 여부 추측 방지)
_DUMMY_HASH = hash_password("dummy-password-for-timing")


def user_out(u: User) -> UserOut:
    return UserOut(
        id=u.id, email=u.email, nickname=u.nickname, role=u.role.value, identity_verified=u.identity_verified_at is not None,
        officer_station_id=u.officer_station_id, officer_station_name=u.officer_station.name if u.officer_station else None,
        officer_rank=u.officer_rank,
    )


def _issue(response: Response, user: User) -> None:
    set_auth_cookies(
        response, create_access_token(user.id, user.token_version), create_refresh_token(user.id, user.token_version),
    )


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(register_limiter)])
def register(body: RegisterIn, response: Response, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 가입된 이메일입니다.")
    user = User(
        email=email, password_hash=hash_password(body.password), nickname=body.nickname,
        terms_agreed_at=datetime.now(timezone.utc), terms_version=body.terms_version or None,
    )
    db.add(user)
    db.commit()
    _issue(response, user)
    return user_out(user)


@router.post("/login", response_model=UserOut, dependencies=[Depends(login_limiter)])
def login(body: LoginIn, response: Response, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(User.email == body.email.lower()))
    ok = verify_password(body.password, user.password_hash if user else _DUMMY_HASH)
    if not user or not ok or not user.is_active:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "이메일 또는 비밀번호가 올바르지 않습니다.")
    _issue(response, user)
    return user_out(user)


@router.post("/refresh", response_model=UserOut, dependencies=[Depends(refresh_limiter)])
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    exc = HTTPException(status.HTTP_401_UNAUTHORIZED, "다시 로그인해 주세요.")
    token = get_refresh_token(request)
    if not token:
        raise exc
    try:
        payload = decode_token(token, expected_type="refresh")
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise exc
    user = db.get(User, user_id)
    if user is None or not user.is_active or not token_matches_user(payload, user):
        raise exc
    _issue(response, user)
    return user_out(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    """쿠키만 지우면 그 전에 복사된(탈취된) 토큰은 만료 때까지 계속 쓸 수 있다 — token_version 을 올려
    이 계정으로 발급된 모든 토큰을 즉시 무효로 만든다(다른 기기의 로그인도 함께 풀린다)."""
    for token, kind in ((get_refresh_token(request), "refresh"), (get_access_token(request), "access")):
        if not token:
            continue
        try:
            payload = decode_token(token, expected_type=kind)
            user = db.get(User, int(payload["sub"]))
        except (JWTError, KeyError, ValueError):
            continue
        if user and token_matches_user(payload, user):
            user.token_version += 1
            db.commit()
            break
    clear_auth_cookies(response)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user_out(user)


@router.delete("/me", status_code=status.HTTP_204_NO_CONTENT, dependencies=[Depends(delete_account_limiter)])
def withdraw(
    body: DeleteAccountIn, response: Response, db: Session = Depends(get_db), user: User = Depends(get_current_user),
):
    """회원 탈퇴. 되돌릴 수 없는 조치라 로그인 세션과 별개로 비밀번호를 한 번 더 확인한다."""
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "비밀번호가 올바르지 않습니다.")
    delete_account(db, user)
    user.token_version += 1  # 탈퇴 전에 발급된 토큰도 즉시 무효(is_active=False 로도 막히지만 이중으로)
    db.commit()
    clear_auth_cookies(response)
