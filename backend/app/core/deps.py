import hashlib
import hmac

from fastapi import Depends, HTTPException, Request, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
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


def get_client_ip_hash(request: Request) -> str:
    """비로그인 사용자를 "IP 하나당 1표"로 제한하기 위한 식별자. 원본 IP를 그대로 저장하면
    투표 테이블만으로 누가 어디서 접속했는지 역추적할 수 있어(개인정보), JWT_SECRET_KEY 를
    HMAC 키로 쓴 해시만 저장한다 — DB가 유출돼도 원본 IP는 복원할 수 없다. request.client.host
    는 nginx 뒤에서 그대로 쓰면 항상 127.0.0.1(프록시 자신)이 찍히므로, uvicorn 을
    --proxy-headers 로 띄워 nginx 가 보내는 X-Forwarded-For 를 신뢰하게 해 뒀다(배포 설정
    참고, rate_limit.py 의 같은 전제와 동일)."""
    ip = request.client.host if request.client else "unknown"
    digest = hmac.new(settings.JWT_SECRET_KEY.encode(), f"vote-ip:{ip}".encode(), hashlib.sha256).hexdigest()
    return digest[:32]


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="관리자 권한이 필요합니다.")
    return user
