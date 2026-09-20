"""관리자 계정 생성/승격.

    python -m scripts.create_admin --email admin@example.com --nickname 운영자

비밀번호는 명령행 인자로 받지 않고(셸 기록에 남는다) 프롬프트로 입력받는다.
이미 가입된 이메일이면 관리자 권한으로 승격한다.
"""
import argparse
import getpass

from sqlalchemy import select

from app.core.database import SessionLocal
from app.core.security import hash_password
from app.models import User, UserRole


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", required=True)
    ap.add_argument("--nickname", default="운영자")
    args = ap.parse_args()
    email = args.email.strip().lower()

    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user:
            user.role = UserRole.admin
            db.commit()
            print(f"기존 계정을 관리자로 승격했습니다: {email}")
            return
        pw = getpass.getpass("비밀번호(8자 이상): ")
        if len(pw) < 8 or len(pw.encode()) > 72:
            raise SystemExit("비밀번호는 8자 이상, 72바이트 이하여야 합니다.")
        if pw != getpass.getpass("비밀번호 확인: "):
            raise SystemExit("비밀번호가 일치하지 않습니다.")
        db.add(User(email=email, password_hash=hash_password(pw), nickname=args.nickname, role=UserRole.admin))
        db.commit()
        print(f"관리자 계정을 만들었습니다: {email}")


if __name__ == "__main__":
    main()
