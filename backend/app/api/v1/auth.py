from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.cookies import clear_auth_cookies, get_refresh_token, set_auth_cookies
from app.core.database import get_db
from app.core.deps import get_current_user
from app.core.rate_limit import login_limiter, register_limiter
from app.core.security import create_access_token, create_refresh_token, decode_token, hash_password, verify_password
from app.models import User
from app.schemas.auth import LoginIn, RegisterIn, UserOut

router = APIRouter(prefix="/auth", tags=["auth"])

# 존재하지 않는 계정에도 같은 시간이 걸리도록 하는 더미 해시(계정 존재 여부 추측 방지)
_DUMMY_HASH = hash_password("dummy-password-for-timing")


def user_out(u: User) -> UserOut:
    return UserOut(id=u.id, email=u.email, nickname=u.nickname, role=u.role.value, identity_verified=u.identity_verified_at is not None)


def _issue(response: Response, user: User) -> None:
    set_auth_cookies(response, create_access_token(user.id), create_refresh_token(user.id))


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED, dependencies=[Depends(register_limiter)])
def register(body: RegisterIn, response: Response, db: Session = Depends(get_db)):
    email = body.email.lower()
    if db.scalar(select(User.id).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "이미 가입된 이메일입니다.")
    user = User(email=email, password_hash=hash_password(body.password), nickname=body.nickname)
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


@router.post("/refresh", response_model=UserOut)
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    exc = HTTPException(status.HTTP_401_UNAUTHORIZED, "다시 로그인해 주세요.")
    token = get_refresh_token(request)
    if not token:
        raise exc
    try:
        user_id = int(decode_token(token, expected_type="refresh")["sub"])
    except (JWTError, KeyError, ValueError):
        raise exc
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise exc
    _issue(response, user)
    return user_out(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response):
    clear_auth_cookies(response)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)):
    return user_out(user)
