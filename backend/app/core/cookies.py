from fastapi import Request, Response

from app.core.config import settings

ACCESS_COOKIE = "pm_access"
REFRESH_COOKIE = "pm_refresh"


def _set(response: Response, name: str, value: str, max_age: int) -> None:
    response.set_cookie(
        name, value, max_age=max_age, httponly=True, secure=settings.COOKIE_SECURE, samesite="lax", path="/"
    )


def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    _set(response, ACCESS_COOKIE, access, settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60)
    _set(response, REFRESH_COOKIE, refresh, settings.REFRESH_TOKEN_EXPIRE_DAYS * 86400)


def clear_auth_cookies(response: Response) -> None:
    for name in (ACCESS_COOKIE, REFRESH_COOKIE):
        response.delete_cookie(name, path="/")


def get_access_token(request: Request) -> str | None:
    return request.cookies.get(ACCESS_COOKIE)


def get_refresh_token(request: Request) -> str | None:
    return request.cookies.get(REFRESH_COOKIE)
