"""개발용 샘플 데이터 적재 (전부 가상 — 프론트 src/data/sample.ts 와 같은 내용).

    python -m scripts.seed            # 비어 있는 DB 에만 적재
    python -m scripts.seed --reset    # 도메인 데이터를 모두 지우고 다시 적재(개발 DB 전용)

지역(시·도경찰청 18곳)은 실제 데이터이고, 경찰서·수사관·평가는 가상 샘플이다.
"""
import argparse
import secrets
from datetime import datetime, timezone

from sqlalchemy import delete, func, select

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.security import hash_case_number, hash_password
from app.models import (
    AuditLog, CaseType, Department, Officer, OfficerAssignment, OfficerSource, PublicStatistic, Region, Review,
    ReviewRole, ReviewStatus, Station, TakedownRequest, User,
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

S = OfficerSource
OFFICERS = [  # (station, department, name, rank, source, assignments)
    ("서울강남경찰서(샘플)", "수사과 경제1팀", "김가상", "경위", S.verified_report,
     [("2024.02", "서울강남경찰서 수사과(샘플)"), ("2021.07", "서울수서경찰서 형사과(샘플)")]),
    ("서울강남경찰서(샘플)", "사이버수사팀", "이허구", "경사", S.homepage, [("2023.08", "서울강남경찰서 사이버수사팀(샘플)")]),
    ("서울마포경찰서(샘플)", "수사과 경제팀", "박모형", "경감", S.announcement,
     [("2022.01", "서울마포경찰서 수사과(샘플)"), ("2019.02", "서울서부경찰서 수사과(샘플)")]),
    ("서울서초경찰서(샘플)", "형사과 강력팀", "최예시", "경위", S.verified_report, [("2023.07", "서울서초경찰서 형사과(샘플)")]),
    ("수원남부경찰서(샘플)", "사이버수사팀", "정샘플", "경사", S.homepage, [("2024.01", "수원남부경찰서 사이버수사팀(샘플)")]),
]

R, C = ReviewRole, CaseType
REVIEWS = [  # (officer, role, case_type, (year, month), stars, text)
    ("김가상", R.complainant, C.fraud, (2026, 7), 3,
     "보완수사 요청 후 3개월간 진행 상황 연락이 없어 직접 여러 차례 문의해야 했습니다. 조사 자체는 절차에 따라 진행되었고 진술 기회는 충분히 부여되었습니다."),
    ("김가상", R.lawyer, C.fraud, (2026, 5), 4,
     "조사 전 진술거부권 등 권리 고지가 정확했고, 변호인 참여에 협조적이었습니다. 조서 열람 시간도 충분히 보장했습니다."),
    ("이허구", R.victim, C.cyber, (2026, 6), 5,
     "접수 단계부터 절차를 상세히 설명해 주었고, 처리 경과를 문자로 먼저 안내해 주었습니다. 압수물 환부 절차도 신속했습니다."),
    ("최예시", R.complainant, C.assault, (2026, 4), 2,
     "조사 중 고소인 진술을 자주 끊었고, 제출한 증거자료 일부가 기록에 반영되지 않아 이의를 제기해야 했습니다. 불송치 이유 설명이 부족했습니다."),
    ("정샘플", R.complainant, C.fraud, (2026, 8), 5,
     "계좌 추적 진행 상황을 단계별로 안내받았습니다. 출석 일정 조율에도 유연하게 응해 주었습니다."),
]

APPEALS = {2018: 2425, 2019: 2900, 2020: 3300, 2021: 3800, 2022: 4400, 2023: 4833}
SAMPLE_SRC = "언론 보도 기반 샘플"


def reset(db) -> None:
    if settings.ENVIRONMENT == "production":
        raise SystemExit("production 환경에서는 --reset 을 사용할 수 없습니다.")
    for model in (AuditLog, TakedownRequest, Review, OfficerAssignment, Officer, Department, Station, Region, PublicStatistic):
        db.execute(delete(model))
    db.execute(delete(User).where(User.email.like("%@example.invalid")))
    db.commit()


def seed(db) -> None:
    for rid, name, full, total in REGIONS:
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

    officers: dict[str, Officer] = {}
    for st_name, dept, name, rank, source, assigns in OFFICERS:
        o = Officer(station_id=stations[st_name].id, department_id=depts[(st_name, dept)].id, name=name, rank=rank, source=source)
        o.assignments = [OfficerAssignment(period=p, description=d) for p, d in assigns]
        db.add(o)
        officers[name] = o
    db.flush()

    # 샘플 평가 작성자: 로그인 불가(무작위 비밀번호), 예약 도메인 이메일
    author = User(email="sample-reviewer@example.invalid", password_hash=hash_password(secrets.token_urlsafe(24)), nickname="샘플 작성자")
    db.add(author)
    db.flush()
    for i, (officer, role, ctype, (y, m), stars, text) in enumerate(REVIEWS, 1):
        published = datetime(y, m, 15, tzinfo=timezone.utc)
        case_no = f"2026-샘플-{i:05d}"
        db.add(Review(
            officer_id=officers[officer].id, author_id=author.id, role=role, case_type=ctype, case_number=case_no,
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
        print(f"완료: 지역 {len(REGIONS)}, 경찰서 {len(STATIONS)}, 수사관 {len(OFFICERS)}, 평가 {len(REVIEWS)}")


if __name__ == "__main__":
    main()
