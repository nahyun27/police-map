"""경찰서 관할구역 경계·텍스트 데이터 생성 스크립트 (1회성 데이터 준비 — 산출물만 커밋하고
이 스크립트 자체는 평소에 다시 돌릴 일이 없다. 원본 PDF 가 바뀌거나 Station 목록이 크게
바뀌었을 때만 재실행한다).

입력:
  1) "[별표 2] 경찰서의 명칭ㆍ위치 및 관할구역(제30조제2항 관련)" — 경찰청과 그 소속기관
     직제 시행규칙 별표 2(2021.12.14 개정). 공공데이터라 저장소에는 안 담아 두고, 실행할
     땐 --pdf 로 로컬 경로를 넘긴다(국가법령정보센터에서 "경찰청과 그 소속기관 직제 시행규칙"
     검색 후 별표 2 PDF를 받으면 된다).
  2) southkorea/southkorea-maps 저장소의 2018년 시군구·읍면동 경계(TopoJSON, 공개 데이터 —
     koreaMap.json 을 만들 때 쓴 것과 같은 출처). 로컬에 없으면 자동으로 받아 캐시한다.
  3) DB 의 Station 테이블(이름·주소·region_id).

이 PDF의 관할구역 칸은 두 가지 패턴이다.
  (a) 구/시/군 전체가 그대로 관할인 경우(전국 대다수) — 그 구/시/군 경계를 그대로 쓸 수 있다.
  (b) 한 구역에 경찰서가 여러 곳이라 동 단위·심지어 도로명 번지 단위로 쪼개고 "~은 제외한다"
      식으로 다른 경찰서 관할을 빼는 경우(서울 도심 등 일부) — 동 경계 데이터로는 표현할 수
      없는 수준이라(같은 동 안에서 도로 기준으로 나뉘기도 한다), 경계는 그리지 않고 원문
      텍스트만 보여준다.
classify() 가 (a)인지 (b)인지 가려서, (a)만 시군구 경계를 합쳐 SVG path 로 투영해 둔다.

사용법 (반드시 pdfplumber, shapely 설치 필요 — requirements.txt 에는 안 올림, 이 스크립트
전용이라 운영 앱은 설치할 필요가 없다):
    pip install pdfplumber shapely
    python -m scripts.build_station_jurisdiction --pdf "/path/to/별표2.pdf"

출력: src/data/stationJurisdiction.json (station id -> 경계 path 또는 원문 텍스트)
"""
import argparse
import json
import math
import re
import sys
import urllib.request
from pathlib import Path

from sqlalchemy import select

from app.core.database import SessionLocal
from app.models import Station

OUT_PATH = Path(__file__).resolve().parent.parent.parent / "src" / "data" / "stationJurisdiction.json"
CACHE_DIR = Path(__file__).resolve().parent.parent / "data" / ".geo-cache"
MUNI_URL = "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-municipalities-2018-topo-simple.json"
SUBMUNI_URL = "https://raw.githubusercontent.com/southkorea/southkorea-maps/master/kostat/2018/json/skorea-submunicipalities-2018-topo-simple.json"

# 시군구 행정구역코드 앞 2자리 -> 이 프로젝트의 Region.id. 경기도만 남부/북부 두 경찰청으로
# 나눠 관리해서 region_id 가 둘(ggs/ggn)이라 하나의 코드가 여러 region 에 매핑된다.
PREFIX_TO_REGIONS = {
    "11": ["seoul"], "21": ["busan"], "22": ["daegu"], "23": ["incheon"], "24": ["gwangju"],
    "25": ["daejeon"], "26": ["ulsan"], "29": ["sejong"], "31": ["ggs", "ggn"], "32": ["gangwon"],
    "33": ["chungbuk"], "34": ["chungnam"], "35": ["jeonbuk"], "36": ["jeonnam"], "37": ["gyeongbuk"],
    "38": ["gyeongnam"], "39": ["jeju"],
}
REGION_TO_PREFIXES: dict[str, list[str]] = {}
for _pfx, _regions in PREFIX_TO_REGIONS.items():
    for _rg in _regions:
        REGION_TO_PREFIXES.setdefault(_rg, []).append(_pfx)


def _fetch_cached(url: str, name: str) -> dict:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    path = CACHE_DIR / name
    if not path.exists():
        print(f"다운로드: {url}", file=sys.stderr)
        urllib.request.urlretrieve(url, path)
    return json.loads(path.read_text(encoding="utf-8"))


def decode_topojson(topo: dict) -> list[dict]:
    """TopoJSON arc 델타 인코딩을 풀어 평범한 GeoJSON 스타일 geometry 리스트로 바꾼다."""
    transform = topo.get("transform")
    scale = transform["scale"] if transform else (1, 1)
    translate = transform["translate"] if transform else (0, 0)
    decoded_arcs = []
    for arc in topo["arcs"]:
        coords, x, y = [], 0, 0
        for dx, dy in arc:
            x += dx
            y += dy
            coords.append((x * scale[0] + translate[0], y * scale[1] + translate[1]))
        decoded_arcs.append(coords)

    def arc_coords(i):
        return decoded_arcs[i] if i >= 0 else list(reversed(decoded_arcs[~i]))

    def ring_coords(arc_indices):
        coords = []
        for i in arc_indices:
            seg = arc_coords(i)
            if coords and tuple(coords[-1]) == tuple(seg[0]):
                coords.extend(seg[1:])
            else:
                coords.extend(seg)
        return coords

    def valid_ring(coords):
        return len(coords) >= 4  # 단순화 과정에서 생긴 퇴화(3점 이하) 고리는 버린다

    def geom_to_geojson_geom(geom):
        t = geom["type"]
        if t == "Polygon":
            rings = [r for r in (ring_coords(r) for r in geom["arcs"]) if valid_ring(r)]
            return {"type": "Polygon", "coordinates": rings} if rings else None
        if t == "MultiPolygon":
            polys = []
            for poly in geom["arcs"]:
                rings = [r for r in (ring_coords(r) for r in poly) if valid_ring(r)]
                if rings:
                    polys.append(rings)
            return {"type": "MultiPolygon", "coordinates": polys} if polys else None
        raise ValueError(f"unsupported geom type {t}")

    obj = list(topo["objects"].values())[0]
    out = []
    for g in obj["geometries"]:
        geom = geom_to_geojson_geom(g)
        if geom is not None:
            out.append({"properties": g["properties"], "geometry": geom})
    return out


def clean(s: str | None) -> str | None:
    if s is None:
        return None
    return re.sub(r"\s+", " ", s.replace("\n", " ")).strip()


def nospace(s: str | None) -> str:
    return re.sub(r"\s+", "", s or "")


def parse_pdf(pdf_path: str) -> list[dict]:
    import pdfplumber  # 이 스크립트에서만 필요 — 운영 앱 의존성에는 안 넣는다.

    pdf = pdfplumber.open(pdf_path)
    raw_rows = []
    for page in pdf.pages:
        for table in page.extract_tables():
            raw_rows.extend(table)

    stations = []
    for r in raw_rows:
        r = [clean(c) for c in r]
        if len(r) < 3:
            continue
        name, addr, juris = r[-3], r[-2], r[-1]
        if nospace(name) == "경찰서명칭" or nospace(juris) == "관할구역":
            continue  # 페이지마다 반복되는 표 헤더
        stations.append({"name": nospace(name), "address": addr, "jurisdiction": juris})
    return stations


def split_top_level_commas(s: str) -> list[str]:
    """괄호 안의 콤마는 무시하고(예: "일부(a, b, c)") 최상위 콤마에서만 나눈다."""
    parts, depth, cur = [], 0, ""
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            parts.append(cur.strip())
            cur = ""
        else:
            cur += ch
    if cur.strip():
        parts.append(cur.strip())
    return parts


_DISTRICT_RE = re.compile(r"^[가-힣·]+(시|군|구)$")
_DONG_CLAUSE_RE = re.compile(r"^([가-힣·]+(?:시|군|구)) 중 (.+)$")


def classify(text: str):
    """관할구역 원문을 "whole"(구/시/군 전체 리스트) / "dong_list"(한 구역 안 동 단위 나열,
    예외 없음) / "complex"(그 외 전부 — 일부·제외·번지 등) 로 가른다."""
    if "일부" in text or "제외" in text or "(" in text:
        return "complex", None
    m = _DONG_CLAUSE_RE.match(text)
    if m:
        district, rest = m.group(1), m.group(2)
        dongs = split_top_level_commas(rest)
        if all(re.match(r"^[가-힣0-9·]+$", d) for d in dongs):
            return "dong_list", {"district": district, "dongs": dongs}
        return "complex", None
    segs = split_top_level_commas(text)
    if segs and all(_DISTRICT_RE.match(s.replace(" ", "")) for s in segs):
        return "whole", {"districts": [s.replace(" ", "") for s in segs]}
    return "complex", None


def project_and_path(geom, station_point=None, pad_ratio: float = 0.08, target: float = 400):
    """위경도 폴리곤을 그 폴리곤 자체의 bbox 에 맞춘 로컬 SVG viewBox(0 0 W H)로 투영한다
    (station/[id] 페이지마다 독립된 작은 지도라 koreaMap.json 전역 투영과 맞출 필요가 없다).
    위도에 따른 가로세로 비율 왜곡은 중심위도 cos 보정으로 간단히 바로잡는다.
    station_point((lng, lat))을 주면 같은 투영으로 경찰서 실제 위치도 함께 좌표를 낸다 —
    관할구역 도형의 기하학적 중심(representative_point)과는 다른, 실제 주소 지점이다."""
    minx, miny, maxx, maxy = geom.bounds
    cos_lat0 = math.cos(math.radians((miny + maxy) / 2))
    w, h = (maxx - minx) * cos_lat0, maxy - miny
    pad = max(w, h) * pad_ratio
    w, h = w + pad * 2, h + pad * 2
    scale = target / max(w, h)

    def proj(x, y):
        return round(((x - minx) * cos_lat0 + pad) * scale, 1), round((maxy - y + pad) * scale, 1)

    def ring_path(coords):
        pts = [proj(x, y) for x, y in coords]
        return "M" + "L".join(f"{x},{y}" for x, y in pts) + "Z"

    poly_groups = [geom.geoms] if geom.geom_type == "MultiPolygon" else [[geom]]
    d_parts = []
    for group in poly_groups:
        for poly in group:
            d_parts.append(ring_path(list(poly.exterior.coords)))
            d_parts.extend(ring_path(list(ring.coords)) for ring in poly.interiors)
    cx, cy = proj(*geom.representative_point().coords[0])
    station_xy = proj(*station_point) if station_point else None
    return " ".join(d_parts), f"0 0 {round(w * scale, 1)} {round(h * scale, 1)}", (cx, cy), station_xy


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True, help="별표2 PDF 로컬 경로")
    args = ap.parse_args()

    from shapely.geometry import shape
    from shapely.ops import unary_union

    print("시군구·읍면동 경계 로드 중...", file=sys.stderr)
    muni_features = decode_topojson(_fetch_cached(MUNI_URL, "municipalities-2018.json"))
    submuni_features = decode_topojson(_fetch_cached(SUBMUNI_URL, "submunicipalities-2018.json"))
    muni_by_name: dict[str, list] = {}
    for f in muni_features:
        muni_by_name.setdefault(f["properties"]["name"], []).append(f)
    submuni_by_parent: dict[str, dict] = {}
    for f in submuni_features:
        code = f["properties"]["code"]
        submuni_by_parent.setdefault(code[:5], {}).setdefault(f["properties"]["name"], []).append(f)

    def find_municipality(name, allowed_prefixes):
        name = name.replace(" ", "")

        def lookup(n):
            cands = [c for c in muni_by_name.get(n, []) if c["properties"]["code"][:2] in allowed_prefixes]
            return cands[0] if cands else None

        hit = lookup(name)
        if hit:
            return hit
        # 행정구역 시행규칙 개정이 늦어 관할구역란에 승격/강등 전 명칭이 그대로 남은 경우가
        # 있다(예: "당진시"로 이미 승격됐는데 관할구역란은 옛 이름 "당진군"인 채로 방치).
        for a, b in (("군", "시"), ("시", "군")):
            if name.endswith(a):
                hit = lookup(name[: -len(a)] + b)
                if hit:
                    return hit
        return None

    def find_submunicipality(parent_code5, name):
        cands = submuni_by_parent.get(parent_code5, {}).get(name.replace(" ", ""))
        return cands[0] if cands else None

    print("PDF 파싱 중...", file=sys.stderr)
    pdf_stations = parse_pdf(args.pdf)
    pdf_by_name = {p["name"]: p for p in pdf_stations}
    print(f"  {len(pdf_stations)}개 관서", file=sys.stderr)

    db = SessionLocal()
    db_stations = db.execute(
        select(Station.id, Station.name, Station.region_id, Station.is_sample, Station.lat, Station.lng)
    ).all()

    stats = {"matched": 0, "unmatched": 0, "whole": 0, "dong_list": 0, "complex": 0}
    out: dict[str, dict] = {}

    for sid, name, region_id, is_sample, lat, lng in db_stations:
        if is_sample:
            continue
        pdf_entry = pdf_by_name.get(name)
        if not pdf_entry:
            stats["unmatched"] += 1
            continue
        stats["matched"] += 1
        text = pdf_entry["jurisdiction"]
        kind, info = classify(text)
        allowed_prefixes = REGION_TO_PREFIXES.get(region_id, [])

        geoms = []
        if kind == "whole":
            for d in info["districts"]:
                f = find_municipality(d, allowed_prefixes)
                if not f:
                    kind = "complex"
                    break
                geoms.append(shape(f["geometry"]).buffer(0))
        elif kind == "dong_list":
            parent = find_municipality(info["district"], allowed_prefixes)
            if not parent:
                kind = "complex"
            else:
                parent_code5 = parent["properties"]["code"][:5]
                for dname in info["dongs"]:
                    f = find_submunicipality(parent_code5, dname)
                    if not f:
                        kind = "complex"
                        break
                    geoms.append(shape(f["geometry"]).buffer(0))

        entry = {"text": text, "kind": kind}
        if kind in ("whole", "dong_list") and geoms:
            try:
                station_point = (lng, lat) if lat is not None and lng is not None else None
                d, viewbox, (cx, cy), station_xy = project_and_path(unary_union(geoms), station_point)
                entry.update({"path": d, "viewBox": viewbox, "labelX": cx, "labelY": cy})
                if station_xy:
                    entry["stationX"], entry["stationY"] = station_xy
            except Exception as e:  # 극히 일부 섬 지역 등에서 위상 오류가 날 수 있다
                print(f"  경계 생성 실패: {name} ({e})", file=sys.stderr)
                entry["kind"] = "complex"
        stats[entry["kind"]] += 1
        # DB 기본키(id)로 키를 잡으면 안 된다 — 로컬 개발 DB와 운영 DB는 같은 관서도 시딩
        # 순서가 달라 id 가 서로 다르게 배정돼 있다(실제로 이 값으로 운영에 배포했다가 다른
        # 관서 지도가 뜨는 걸 확인함). 이름은 "고성경찰서"처럼 동명이인이 있어 region_id 를
        # 더해 키를 만든다 — 어느 환경에서 돌려도 항상 같은 키가 나온다.
        out[f"{name}:{region_id}"] = entry

    print(json.dumps(stats, ensure_ascii=False, indent=2), file=sys.stderr)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"저장: {OUT_PATH}", file=sys.stderr)


if __name__ == "__main__":
    main()
