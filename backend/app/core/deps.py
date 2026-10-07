from fastapi import Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.cookies import get_access_token
from app.core.database import get_db
from app.core.security import decode_token
from app.models.user import User, UserRole


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="로그인이 필요합니다.")
    token = get_access_token(request)
    if not token:
        raise exc
    try:
        user_id = int(decode_token(token, expected_type="access")["sub"])
    except (JWTError, KeyError, ValueError):
        raise exc
    user = db.get(User, user_id)
    if user is None or not user.is_active:
        raise exc
    return user


def get_current_user_optional(request: Request, db: Session = Depends(get_db)) -> User | None:
    """로그인 여부에 따라 동작이 달라지는(익명도 허용하는) 엔드포인트용. 토큰이 없거나
    유효하지 않아도 401 을 내지 않고 그냥 None 을 돌려준다."""
    token = get_access_token(request)
    if not token:
        return None
    try:
        user_id = int(decode_token(token, expected_type="access")["sub"])
    except (JWTError, KeyError, ValueError):
        return None
    user = db.get(User, user_id)
    return user if user and user.is_active else None


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="관리자 권한이 필요합니다.")
    return user
