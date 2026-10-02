"""프론트엔드 지도 핀 투영용으로 (관서 id, 지역 id, 위도, 경도)만 JSON으로 내보낸다.
geocode_stations.py 실행 후 1회성으로 쓰는 보조 스크립트.

    python -m scripts.export_station_coords > /tmp/station_coords_for_pins.json
"""
import json

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import Station


def main() -> None:
    db = SessionLocal()
    try:
        stations = db.scalars(select(Station).where(~Station.is_sample)).all()
        out = [
            {"id": s.id, "region": s.region_id, "lat": s.lat, "lng": s.lng}
            for s in stations
        ]
        print(json.dumps(out, ensure_ascii=False))
    finally:
        db.close()


if __name__ == "__main__":
    main()
