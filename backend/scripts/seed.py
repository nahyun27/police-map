"""개발용 샘플 데이터 적재 (전부 가상 — 프론트 src/data/sample.ts 와 같은 내용).

    python -m scripts.seed            # 비어 있는 DB 에만 적재
    python -m scripts.seed --reset    # 도메인 데이터를 모두 지우고 다시 적재(개발 DB 전용)

지역(시·도경찰청 18곳)은 실제 데이터이고, 샘플 경찰서·평가는 가상이다. 수사관은 개인 단위
평가 기능이 재도입될 때까지 쓰이지 않지만, 관리자 CRUD 데모용으로 하나만 곁들여 둔다
(2026-09 의뢰인 결정: 평가는 경찰서 단위로만 받는다).
"""
import argparse
from datetime import datetime, timezone

from sqlalchemy import delete, func, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_case_number
from app.models import (
    AuditLog, CaseType, Department, Officer, OfficerAssignment, OfficerSource, PublicStatistic, Region, Review,
    ReviewRole, ReviewStatus, Station, TakedownRequest,
)

REGIONS = [
    ("seoul", "서울", "서울경찰청", 31), ("busan", "부산", "부산경찰청", 15), ("daegu", "대구", "대구경찰청", 11),
    ("incheon", "인천", "인천경찰청", 10), ("gwangju", "광주", "광주경찰청", 5), ("daejeon", "대전", "대전경찰청", 6),
    ("ulsan", "울산", "울산경찰청", 5), ("sejong", "세종", "세종경찰청", 1), ("ggs", "경기남부", "경기남부경찰청", 31),
    ("ggn", "경기북부", "경기북부경찰청", 13), ("gangwon", "강원", "강원경찰청", 17), ("chungbuk", "충북", "충북경찰청", 12),
    ("chungnam", "충남", "충남경찰청", 15), ("jeonbuk", "전북", "전북경찰청", 15), ("jeonnam", "전남", "전남경찰청", 22),
    ("gyeongbuk", "경북", "경북경찰청", 23), ("gyeongnam", "경남", "경남경찰청", 23), ("jeju", "제주", "제주경찰청", 3),
]

STATIONS = [  # (region, name, departments)
    ("seoul", "서울강남경찰서(샘플)", ["수사과 경제1팀", "수사과 경제2팀", "형사과 강력팀", "사이버수사팀", "여성청소년과"]),
    ("seoul", "서울마포경찰서(샘플)", ["수사과 경제팀", "형사과", "사이버수사팀"]),
    ("seoul", "서울서초경찰서(샘플)", ["수사과 경제1팀", "형사과 강력팀", "여성청소년과"]),
    ("ggs", "수원남부경찰서(샘플)", ["수사과 경제팀", "형사과", "사이버수사팀"]),
    ("busan", "부산해운대경찰서(샘플)", ["수사과", "형사과", "여성청소년과"]),
]

R, C = ReviewRole, CaseType
REVIEWS = [  # (station, role, case_type, (year, month), stars, text)
    ("서울강남경찰서(샘플)", R.complainant, C.fraud, (2026, 7), 3,
     "보완수사 요청 후 3개월간 진행 상황 연락이 없어 직접 여러 차례 문의해야 했습니다. 조사 자체는 절차에 따라 진행되었고 진술 기회는 충분히 부여되었습니다."),
    ("서울강남경찰서(샘플)", R.lawyer, C.fraud, (2026, 5), 4,
     "조사 전 진술거부권 등 권리 고지가 정확했고, 변호인 참여에 협조적이었습니다. 조서 열람 시간도 충분히 보장했습니다."),
    ("서울강남경찰서(샘플)", R.victim, C.cyber, (2026, 6), 5,
     "접수 단계부터 절차를 상세히 설명해 주었고, 처리 경과를 문자로 먼저 안내해 주었습니다. 압수물 환부 절차도 신속했습니다."),
    ("서울서초경찰서(샘플)", R.complainant, C.assault, (2026, 4), 2,
     "조사 중 고소인 진술을 자주 끊었고, 제출한 증거자료 일부가 기록에 반영되지 않아 이의를 제기해야 했습니다. 불송치 이유 설명이 부족했습니다."),
    ("수원남부경찰서(샘플)", R.complainant, C.fraud, (2026, 8), 5,
     "계좌 추적 진행 상황을 단계별로 안내받았습니다. 출석 일정 조율에도 유연하게 응해 주었습니다."),
]

# 관리자 CRUD 데모용 수사관 1명 — 평가와는 무관(개인 단위 평가는 아직 없다).
DEMO_OFFICER = ("서울강남경찰서(샘플)", "수사과 경제1팀", "김가상", "경위", OfficerSource.verified_report,
                 [("2024.02", "서울강남경찰서 수사과(샘플)"), ("2021.07", "서울수서경찰서 형사과(샘플)")])

APPEALS = {2018: 2425, 2019: 2900, 2020: 3300, 2021: 3800, 2022: 4400, 2023: 4833}
SAMPLE_SRC = "언론 보도 기반 샘플"


def reset(db) -> None:
    """샘플 데이터만 지우고 다시 적재한다. 지역과 실데이터 경찰서(is_sample=False, scripts/import_stations
    로 적재)는 건드리지 않는다 — 그걸 지우면 위키백과 대조까지 거친 실데이터를 매번 다시 가져와야 한다."""
    if settings.ENVIRONMENT == "production":
        raise SystemExit("production 환경에서는 --reset 을 사용할 수 없습니다.")
    sample_station_ids = select(Station.id).where(Station.is_sample.is_(True))
    db.execute(delete(TakedownRequest))  # 출시 전 더미 데이터뿐이라 전부 비운다
    db.execute(delete(AuditLog))
    db.execute(delete(Review).where(Review.station_id.in_(sample_station_ids)))
    db.execute(delete(OfficerAssignment))
    db.execute(delete(Officer))  # 현재 관리자 CRUD 데모용 1명뿐 — 실수사관 데이터는 아직 없다
    db.execute(delete(Department).where(Department.station_id.in_(sample_station_ids)))
    db.execute(delete(Station).where(Station.is_sample.is_(True)))
    db.execute(delete(PublicStatistic))
    db.commit()


def seed(db) -> None:
    for rid, name, full, total in REGIONS:
        if not db.get(Region, rid):  # import_stations 가 이미 만들어 둔 지역은 건드리지 않는다
            db.add(Region(id=rid, name=name, full_name=full, station_total=total))
    db.flush()

    stations: dict[str, Station] = {}
    depts: dict[tuple[str, str], Department] = {}
    for region, name, dept_names in STATIONS:
        st = Station(region_id=region, name=name, is_sample=True)
        db.add(st)
        db.flush()
        stations[name] = st
        for dn in dept_names:
            d = Department(station_id=st.id, name=dn)
            db.add(d)
            depts[(name, dn)] = d
    db.flush()

    st_name, dept, name, rank, source, assigns = DEMO_OFFICER
    officer = Officer(station_id=stations[st_name].id, department_id=depts[(st_name, dept)].id, name=name, rank=rank, source=source)
    officer.assignments = [OfficerAssignment(period=p, description=d) for p, d in assigns]
    db.add(officer)
    db.flush()

    for i, (station, role, ctype, (y, m), stars, text) in enumerate(REVIEWS, 1):
        published = datetime(y, m, 15, tzinfo=timezone.utc)
        case_no = f"2026-샘플-{i:05d}"
        db.add(Review(
            station_id=stations[station].id, role=role, case_type=ctype, case_number=case_no,
            case_number_hash=hash_case_number(case_no), fair=stars, proc=stars, att=stars, comm=stars, speed=stars, body=text,
            status=ReviewStatus.published, published_at=published, reviewed_at=published,
        ))

    for year, value in APPEALS.items():
        db.add(PublicStatistic(key="appeals_filed", year=year, value=value, source=SAMPLE_SRC))
    db.add(PublicStatistic(key="appeal_acceptance_rate", year=2023, value=65, source=SAMPLE_SRC))
    db.commit()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--reset", action="store_true", help="기존 도메인 데이터를 지우고 다시 적재(개발 DB 전용)")
    args = ap.parse_args()
    with SessionLocal() as db:
        if args.reset:
            reset(db)
        elif db.scalar(select(func.count(Region.id))):
            raise SystemExit("이미 데이터가 있습니다. 다시 적재하려면 --reset 을 사용하세요.")
        seed(db)
        print(f"완료: 지역 {len(REGIONS)}, 경찰서 {len(STATIONS)}, 평가 {len(REVIEWS)} (관리자 데모용 수사관 1명 포함)")


if __name__ == "__main__":
    main()
