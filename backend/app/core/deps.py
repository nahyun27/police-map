import hashlib
import hmac

from fastapi import Depends, HTTPException, Request, Response, status
from jose import JWTError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.client_ip import real_client_ip
from app.core.cookies import get_access_token, get_refresh_token, set_access_cookie
from app.core.database import get_db
from app.core.security import create_access_token, decode_token, token_matches_user
from app.models.user import User, UserRole


def _user_from_cookies(request: Request, response: Response, db: Session) -> User | None:
    """access 토큰으로 사용자를 찾고, 없거나 만료됐으면 refresh 토큰으로 이어 준다(새 access 쿠키도 발급).

    access 쿠키는 30분이면 브라우저에서 사라지는데, 그 뒤로 "로그인한 줄 아는" 사용자의 요청이
    익명으로 처리돼 글이 본인 계정과 연결되지 않는 문제가 있었다(2026-10 출시 전 점검). refresh 쿠키는
    원래 모든 요청에 함께 오므로 여기서 쓰는 것이 노출 범위를 넓히지 않고, 로그아웃·탈퇴 시
    token_version 으로 함께 무효화된다."""
    token = get_access_token(request)
    if token:
        try:
            payload = decode_token(token, expected_type="access")
            user = db.get(User, int(payload["sub"]))
            if user and user.is_active and token_matches_user(payload, user):
                return user
        except (JWTError, KeyError, ValueError):
            pass
    refresh = get_refresh_token(request)
    if refresh:
        try:
            payload = decode_token(refresh, expected_type="refresh")
            user = db.get(User, int(payload["sub"]))
        except (JWTError, KeyError, ValueError):
            return None
        if user and user.is_active and token_matches_user(payload, user):
            set_access_cookie(response, create_access_token(user.id, user.token_version))
            return user
    return None


def get_current_user(request: Request, response: Response, db: Session = Depends(get_db)) -> User:
    user = _user_from_cookies(request, response, db)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="로그인이 필요합니다.")
    return user


def get_current_user_optional(request: Request, response: Response, db: Session = Depends(get_db)) -> User | None:
    """로그인 여부에 따라 동작이 달라지는(익명도 허용하는) 엔드포인트용. 토큰이 없거나
    유효하지 않아도 401 을 내지 않고 그냥 None 을 돌려준다."""
    return _user_from_cookies(request, response, db)


def get_client_ip_hash(request: Request) -> str:
    """비로그인 사용자를 "IP 하나당 1표"로 제한하기 위한 식별자. 원본 IP를 그대로 저장하면
    투표 테이블만으로 누가 어디서 접속했는지 역추적할 수 있어(개인정보), JWT_SECRET_KEY 를
    HMAC 키로 쓴 해시만 저장한다 — DB가 유출돼도 원본 IP는 복원할 수 없다. request.client.host
    는 nginx 뒤에서 그대로 쓰면 항상 127.0.0.1(프록시 자신)이 찍히므로, uvicorn 을
    --proxy-headers 로 띄워 nginx 가 보내는 X-Forwarded-For 를 신뢰하게 해 뒀다(배포 설정
    참고, rate_limit.py 의 같은 전제와 동일)."""
    ip = real_client_ip(request)  # Cloudflare(policemap.kr) 경유면 원래 IP(core/client_ip.py)
    digest = hmac.new(settings.JWT_SECRET_KEY.encode(), f"vote-ip:{ip}".encode(), hashlib.sha256).hexdigest()
    return digest[:32]


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="관리자 권한이 필요합니다.")
    return user
