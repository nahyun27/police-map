"""개인정보 보관 기간 경과분을 지금 바로 파기한다(평소에는 서버가 하루마다 자동 실행, app/main.py).

    python -m scripts.purge_expired
"""
from app.core.database import SessionLocal
from app.services.retention import run_purge

if __name__ == "__main__":
    with SessionLocal() as db:
        print(run_purge(db))
