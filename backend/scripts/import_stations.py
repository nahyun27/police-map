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
    "본청": "national",
    "서울": "seoul", "부산": "busan", "대구": "daegu", "인천": "incheon", "광주": "gwangju",
    "대전": "daejeon", "울산": "ulsan", "세종": "sejong", "경기남부": "ggs", "경기북부": "ggn",
    "강원": "gangwon", "충북": "chungbuk", "충남": "chungnam", "전북": "jeonbuk", "전남": "jeonnam",
    "경북": "gyeongbuk", "경남": "gyeongnam", "제주": "jeju",
}

# 데이터의 구분 → Station.kind. 2026-10 부터 시·도경찰청과 경찰청 본청·국가수사본부도 직속 수사부서를 두고
# 평가할 수 있게 Station 으로 들여온다(의뢰인 요청: "서울청 같은 상급 경찰청이 없다").
KIND_BY_TYPE = {"경찰서": "station", "경찰단": "station", "시도경찰청": "provincial", "경찰청": "national", "국가수사본부": "national"}
# 경찰청 본청·국가수사본부를 담는 지역. 지도에는 없는 지역이라 seed.py 대신 여기서 만든다.
NATIONAL_REGION = ("national", "본청", "경찰청 본청")


def _alias(item: dict, region_name: str) -> str | None:
    """사람들이 실제로 검색하는 이름. 공식 명칭(서울특별시경찰청)으로는 "서울청"이 검색되지 않는다."""
    if item["type"] == "시도경찰청":
        return f"{region_name}경찰청 {region_name}청"
    if item["type"] == "국가수사본부":
        return "국수본 국가수사본부"
    if item["type"] == "경찰청":
        return "경찰청 본청"
    return None


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
        if not region and slug == NATIONAL_REGION[0]:
            region = Region(id=slug, name=NATIONAL_REGION[1], full_name=NATIONAL_REGION[2])
            db.add(region)
        if not region:
            raise SystemExit(f"Region '{slug}' 이 DB 에 없습니다. 먼저 python -m scripts.seed 를 실행하세요.")

        hq = next((s for s in items if s["type"] == "시도경찰청"), None)
        if hq:
            region.hq_address, region.hq_website = hq["address"], hq["website"]
        unknown = {s["type"] for s in items} - set(KIND_BY_TYPE)
        if unknown:
            raise SystemExit(f"알 수 없는 관서 구분: {unknown} (KIND_BY_TYPE 매핑을 추가하세요)")
        station_items = items
        # "관할 경찰서 N곳"은 경찰서만 센다(시·도경찰청 자신이나 본청 기관은 빼고).
        police_station_count = sum(1 for s in items if KIND_BY_TYPE[s["type"]] == "station")
        if region.station_total != police_station_count:
            region.station_total = police_station_count
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
            station.address, station.website = item["address"], item["website"]
            # 부서 목록 출처가 따로 있으면(시·도경찰청·본청) 그걸, 아니면 전체 데이터 출처를 쓴다.
            station.source = item.get("dept_source") or payload["meta"]["source"]
            station.kind, station.search_alias = KIND_BY_TYPE[item["type"]], _alias(item, region_name)
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
