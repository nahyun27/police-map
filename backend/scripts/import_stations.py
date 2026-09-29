"""전국 경찰관서 실데이터 적재 (data/police_stations.json, 출처는 data/README.md 참고).

멱등적으로 동작한다 — 여러 번 실행해도 중복 생성되지 않고, (지역, 관서명) 이 같으면
주소·홈페이지·부서 목록을 최신 데이터로 갱신한다. 기존 샘플 관서(is_sample=True)는
건드리지 않는다.

    python -m scripts.import_stations
    python -m scripts.import_stations --file path/to/other.json
"""
import argparse
import json
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import SessionLocal
from app.models import Department, Region, Station

DEFAULT_FILE = Path(__file__).resolve().parent.parent / "data" / "police_stations.json"

# 데이터의 지역명(한글) → 우리 DB 의 Region.id(슬러그). REGIONS 개수·구성은 scripts/seed.py 와 동일해야 한다.
REGION_SLUG = {
    "서울": "seoul", "부산": "busan", "대구": "daegu", "인천": "incheon", "광주": "gwangju",
    "대전": "daejeon", "울산": "ulsan", "세종": "sejong", "경기남부": "ggs", "경기북부": "ggn",
    "강원": "gangwon", "충북": "chungbuk", "충남": "chungnam", "전북": "jeonbuk", "전남": "jeonnam",
    "경북": "gyeongbuk", "경남": "gyeongnam", "제주": "jeju",
}

# 이 구분만 Station 으로 들여온다. 시·도경찰청(본청)은 각 관서를 관할하는 상위 조직으로,
# 국민이 평가하는 "관서" 단위가 아니므로 Region.hq_* 필드에만 반영한다.
STATION_TYPES = {"경찰서", "경찰단"}


def import_data(db: Session, payload: dict) -> dict[str, int]:
    stats = {"region_updated": 0, "station_created": 0, "station_updated": 0, "department_synced": 0}

    by_region: dict[str, list[dict]] = {}
    for s in payload["stations"]:
        by_region.setdefault(s["region"], []).append(s)

    for region_name, items in by_region.items():
        slug = REGION_SLUG.get(region_name)
        if not slug:
            raise SystemExit(f"알 수 없는 지역명: {region_name!r} (REGION_SLUG 매핑을 추가하세요)")
        region = db.get(Region, slug)
        if not region:
            raise SystemExit(f"Region '{slug}' 이 DB 에 없습니다. 먼저 python -m scripts.seed 를 실행하세요.")

        hq = next((s for s in items if s["type"] == "시도경찰청"), None)
        if hq:
            region.hq_address, region.hq_website = hq["address"], hq["website"]
        station_items = [s for s in items if s["type"] in STATION_TYPES]
        if region.station_total != len(station_items):
            region.station_total = len(station_items)
        stats["region_updated"] += 1

        for item in station_items:
            station = db.scalar(
                select(Station).where(Station.region_id == slug, Station.name == item["name"], Station.is_sample.is_(False))
            )
            if station is None:
                station = Station(region_id=slug, name=item["name"], is_sample=False)
                db.add(station)
                stats["station_created"] += 1
            else:
                stats["station_updated"] += 1
            station.address, station.website, station.source = item["address"], item["website"], payload["meta"]["source"]
            db.flush()  # station.id 확보(신규 생성분 포함)

            existing = {d.name: d for d in db.scalars(select(Department).where(Department.station_id == station.id))}
            wanted = list(dict.fromkeys(item["departments"]))  # 원본 중복 방어, 순서 유지
            for name in wanted:
                if name not in existing:
                    db.add(Department(station_id=station.id, name=name))
            for name, dept in existing.items():
                if name not in wanted:
                    db.delete(dept)
            stats["department_synced"] += 1

    return stats


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", type=Path, default=DEFAULT_FILE)
    args = ap.parse_args()

    payload = json.loads(args.file.read_text(encoding="utf-8"))
    with SessionLocal() as db:
        stats = import_data(db, payload)
        db.commit()
    print(
        f"완료: 지역 {stats['region_updated']}곳 갱신, 관서 신규 {stats['station_created']}곳,"
        f" 기존 갱신 {stats['station_updated']}곳, 부서 목록 동기화 {stats['department_synced']}건"
    )


if __name__ == "__main__":
    main()
