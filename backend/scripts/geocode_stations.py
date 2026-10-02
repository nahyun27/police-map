"""경찰서 주소를 위도/경도로 변환해 Station.lat/lng 에 채워 넣는다(지도 핀 표시용).

OpenStreetMap Nominatim(무료, API 키 불필요)을 쓴다. 사용 정책상 초당 1건으로 제한해야
하므로, 이미 좌표가 있는 관서는 건너뛰고(멱등적), data/station_coords.json 스냅샷에 결과를
남겨 다음 실행(또는 다른 개발자의 DB)에서는 네트워크 호출 없이 바로 채울 수 있게 한다.

검색 전략(정확도 순):
  ① 정식 지역명 + 주소로 검색 (가장 신뢰도 높음)
  ② 주소만으로 검색
  ③ 세부 도로·건물번호를 뗀 기본 도로명까지만 검색 (세부 도로가 OSM 한국 데이터셋에
     없는 경우 보완 — 건물 단위는 아니지만 같은 도로 위라 민간 정확도로는 충분)
  ④ 정식 지역명 + 관서명으로 검색 — 단, 결과의 시/군/구가 우리 주소의 시/군/구와
     일치할 때만 채택한다. ("고성경찰서"처럼 같은 이름이 강원·경남에 둘 다 있고,
     이름만으로 검색하면 OSM이 엉뚱한 지역의 동명 파출소를 돌려주는 사례가 실제로 있었다.)
  ⑤ 관서명 단독 검색 — 역시 ④와 같은 시/군/구 일치 검증을 거친다.
모두 실패하면 좌표를 비워 두고(lat/lng=null) 지도에서 그 관서는 생략한다.

    python -m scripts.geocode_stations            # DB에서 좌표 없는 관서만 처리
    python -m scripts.geocode_stations --dry-run   # 호출 결과만 출력, DB 반영 안 함
    python -m scripts.geocode_stations --force     # 스냅샷·DB에 이미 있어도 다시 조회
"""
import argparse
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import Region, Station

SNAPSHOT_FILE = Path(__file__).resolve().parent.parent / "data" / "station_coords.json"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
USER_AGENT = "policemap-dev-geocoder/0.1 (contact: ops@policemap.kr)"
RATE_LIMIT_SEC = 1.1  # Nominatim 사용 정책: 초당 1건 이하

# 데이터의 지역 약칭 → 지오코딩 검색에 쓰는 정식 행정구역명.
FULL_REGION_NAME = {
    "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시", "인천": "인천광역시",
    "광주": "광주광역시", "대전": "대전광역시", "울산": "울산광역시", "세종": "세종특별자치시",
    "경기남부": "경기도", "경기북부": "경기도", "강원": "강원특별자치도",
    "충북": "충청북도", "충남": "충청남도", "전북": "전라북도", "전남": "전라남도",
    "경북": "경상북도", "경남": "경상남도", "제주": "제주특별자치도",
}

# 주소에서 "OO시/OO군/OO구"(시/군/구 단위) 토큰을 뽑아내는 패턴 — 결과 검증에 쓴다.
LOCALITY_RE = re.compile(r"[가-힣]+(?:시|군|구)(?=\s|$)")

# 세부 도로(예: "수미로 14번길")나 건물번호까지 들어간 주소는 Nominatim의 한국 도로 데이터셋에
# 없는 경우가 있다 — 끝의 "n번길 건물번호" 또는 "건물번호"만 떼어 기본 도로명까지만 남긴다.
_SUBROAD_RE = re.compile(r"\s+\d+번길\s*\d*-?\d*\s*$")
_BUILDING_NO_RE = re.compile(r"\s+\d+-?\d*\s*$")


def _road_only(address: str) -> str | None:
    stripped = _SUBROAD_RE.sub("", address)
    if stripped == address:
        stripped = _BUILDING_NO_RE.sub("", address)
    return stripped if stripped != address else None


def _key(region_name: str, station_name: str) -> str:
    return f"{region_name}::{station_name}"


def _extract_locality(address: str | None) -> str | None:
    """주소에서 가장 앞에 나오는 시/군/구 토큰을 뽑는다. 못 찾으면 None."""
    if not address:
        return None
    tokens = LOCALITY_RE.findall(address)
    # "서울시" 같은 광역 단위는 너무 넓어 검증 기준으로 부적합하니 제외하고, 그다음(구/군)을 쓴다.
    for t in tokens:
        if t not in ("서울시", "경기도"):
            return t
    return None


def _query_nominatim(q: str) -> dict | None:
    url = f"{NOMINATIM_URL}?{urllib.parse.urlencode({'q': q, 'format': 'json', 'limit': 1, 'countrycodes': 'kr'})}"
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            results = json.loads(resp.read().decode("utf-8"))
    except Exception as e:  # noqa: BLE001 — 네트워크 오류는 그냥 "매칭 실패"로 취급
        print(f"    조회 실패({q!r}): {e}")
        return None
    return results[0] if results else None


def geocode_one(region_name: str, station_name: str, address: str | None) -> dict | None:
    full_region = FULL_REGION_NAME.get(region_name, region_name)
    # "새말로 97, 신도림 테크노마트 5층"처럼 쉼표 뒤에 건물명·층수가 붙은 경우 검색에 방해만
    # 되므로, 지오코딩용으로는 쉼표 앞부분(도로명+번지)만 쓴다.
    if address and "," in address:
        address = address.split(",")[0].strip()
    locality = _extract_locality(address)

    # ①②: 주소 기반 — 가장 신뢰도 높으므로 검증 없이 채택
    address_candidates = []
    if address:
        address_candidates = [address] if address.startswith(full_region) else [f"{full_region} {address}", address]
    for q in address_candidates:
        time.sleep(RATE_LIMIT_SEC)
        hit = _query_nominatim(q)
        if hit:
            return {"lat": float(hit["lat"]), "lng": float(hit["lon"]), "matched_query": q,
                     "matched_name": hit.get("display_name"), "confidence": "address"}

    # ③: 세부 도로·건물번호를 뗀 "기본 도로명까지만" 주소 — 건물 단위는 아니지만 같은 도로 위라
    # 민간 정확도로는 충분하다(세부도로가 Nominatim의 한국 도로 데이터셋에 없는 경우를 위한 보완).
    if address:
        road = _road_only(address)
        if road:
            q = road if road.startswith(full_region) else f"{full_region} {road}"
            time.sleep(RATE_LIMIT_SEC)
            hit = _query_nominatim(q)
            if hit:
                return {"lat": float(hit["lat"]), "lng": float(hit["lon"]), "matched_query": q,
                         "matched_name": hit.get("display_name"), "confidence": "address-road"}

    # ④⑤: 관서명 기반 — 결과의 시/군/구가 우리 주소와 일치할 때만 채택(동명이인 관서 오매칭 방지)
    name_candidates = [f"{full_region} {station_name}", station_name]
    for q in name_candidates:
        time.sleep(RATE_LIMIT_SEC)
        hit = _query_nominatim(q)
        if not hit:
            continue
        display = hit.get("display_name", "")
        if locality and locality not in display:
            print(f"    보류: {q!r} -> {display!r} (주소의 '{locality}'와 불일치, 채택 안 함)")
            continue
        return {"lat": float(hit["lat"]), "lng": float(hit["lon"]), "matched_query": q,
                 "matched_name": display, "confidence": "name" if locality else "name-unverified"}
    return None


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="DB에 반영하지 않고 결과만 출력")
    parser.add_argument("--force", action="store_true", help="이미 좌표가 있어도 다시 조회")
    args = parser.parse_args()

    snapshot: dict[str, dict] = {}
    if SNAPSHOT_FILE.exists():
        snapshot = json.loads(SNAPSHOT_FILE.read_text(encoding="utf-8"))

    db = SessionLocal()
    try:
        stations = db.scalars(select(Station).where(~Station.is_sample)).all()
        regions = {r.id: r for r in db.scalars(select(Region)).all()}

        matched_from_cache = matched_from_api = failed = skipped = 0
        unverified: list[str] = []
        failures: list[str] = []

        for st in stations:
            if not args.force and st.lat is not None and st.lng is not None:
                skipped += 1
                continue

            region_name = regions[st.region_id].name
            key = _key(region_name, st.name)

            if not args.force and key in snapshot:
                hit = snapshot[key]
                matched_from_cache += 1
            else:
                print(f"조회 중: {region_name} {st.name}")
                hit = geocode_one(region_name, st.name, st.address)
                if hit is None:
                    failed += 1
                    failures.append(f"{region_name} {st.name} ({st.address})")
                    continue
                snapshot[key] = hit
                matched_from_api += 1

            if hit.get("confidence") == "name-unverified":
                unverified.append(f"{region_name} {st.name} -> {hit.get('matched_name')}")

            if not args.dry_run:
                st.lat = hit["lat"]
                st.lng = hit["lng"]
                # 한 건씩 바로 커밋·스냅샷 저장 — 263건을 한 번에 모아뒀다가 끝에만 반영하면
                # 중간에 끊겼을 때(네트워크 오류, Ctrl-C 등) 지금까지 한 작업이 통째로 날아간다.
                db.commit()
                SNAPSHOT_FILE.write_text(
                    json.dumps(snapshot, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8"
                )

        print()
        print(f"스냅샷에서 바로 채움: {matched_from_cache}")
        print(f"API로 새로 조회: {matched_from_api}")
        print(f"이미 좌표 있어 건너뜀: {skipped}")
        print(f"매칭 실패: {failed}")
        if failures:
            print("  실패 목록:")
            for f in failures:
                print(f"  - {f}")
        if unverified:
            print(f"  검증 불가(주소에 시/군/구 단위가 없어 결과를 그대로 신뢰): {len(unverified)}")
            for u in unverified:
                print(f"  - {u}")
        if args.dry_run:
            print("\n(--dry-run 이므로 DB·스냅샷에는 반영하지 않았습니다)")
    finally:
        db.close()


if __name__ == "__main__":
    main()
