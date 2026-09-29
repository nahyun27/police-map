import os

# 앱 모듈을 import 하기 전에 반드시 설정한다 — 테스트가 개발용 Postgres 를 건드리면 안 된다.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["ENVIRONMENT"] = "development"

from datetime import datetime, timezone  # noqa: E402

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

from app.core.database import Base, get_db  # noqa: E402
from app.core.rate_limit import ALL_LIMITERS  # noqa: E402
from app.core.security import hash_case_number, hash_password  # noqa: E402
from app.main import app  # noqa: E402
from app.models import (  # noqa: E402
    CaseType, Department, Officer, OfficerSource, Region, Review, ReviewRole, ReviewStatus, Station, User, UserRole,
)


@pytest.fixture()
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, autoflush=False)
    session = Session()

    def override():
        s = Session()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = override
    for lim in ALL_LIMITERS:
        lim.reset()
    yield session
    session.close()
    app.dependency_overrides.clear()
    engine.dispose()


def make_user(db, email="user@example.com", role=UserRole.user, password="password123", verified=False):
    u = User(
        email=email, password_hash=hash_password(password), nickname="tester", role=role,
        identity_verified_at=datetime.now(timezone.utc) if verified else None,
    )
    db.add(u)
    db.commit()
    return u


@pytest.fixture()
def client(db):
    return TestClient(app)


def login(c: TestClient, email: str, password: str = "password123"):
    r = c.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert r.status_code == 200, r.text
    return c


@pytest.fixture()
def user_client(db):
    make_user(db)
    return login(TestClient(app), "user@example.com")


@pytest.fixture()
def admin_client(db):
    make_user(db, "admin@example.com", UserRole.admin)
    return login(TestClient(app), "admin@example.com")


@pytest.fixture()
def world(db):
    """지역 1 · 경찰서 2(station: 평가 2건 게시 / station2: 평가 없음) · 수사관 1(관리자 CRUD 데모용,
    평가 기능과는 무관 — 평가는 경찰서 단위로만 받는다)."""
    db.add(Region(id="seoul", name="서울", full_name="서울경찰청", station_total=31))
    station = Station(region_id="seoul", name="테스트경찰서", is_sample=True)
    station2 = Station(region_id="seoul", name="테스트경찰서2", is_sample=True)
    db.add_all([station, station2])
    db.flush()
    d1, d2 = Department(station_id=station.id, name="수사과"), Department(station_id=station.id, name="사이버수사팀")
    db.add_all([d1, d2])
    db.flush()
    officer = Officer(station_id=station.id, department_id=d1.id, name="가상갑", rank="경위", source=OfficerSource.announcement)
    db.add(officer)
    db.flush()
    reviews = []
    for i, (stars, when) in enumerate([(3, 5), (4, 7)]):
        r = Review(
            station_id=station.id, role=ReviewRole.complainant, case_type=CaseType.fraud,
            case_number=f"CASE-{i}", case_number_hash=hash_case_number(f"CASE-{i}"),
            fair=stars, proc=stars, att=stars, comm=stars, speed=stars, body=f"후기 {i}",
            status=ReviewStatus.published, published_at=datetime(2026, when, 1, tzinfo=timezone.utc),
        )
        db.add(r)
        reviews.append(r)
    db.commit()
    return {"station": station, "station2": station2, "officer": officer, "reviews": reviews}


def review_payload(station_id: int, **over):
    body = {
        "station_id": station_id, "role": "complainant", "case_type": "fraud", "case_number": "2026-형제-12345",
        "ratings": {"fair": 4, "proc": 5}, "body": "절차에 따라 진행되었습니다.",
    }
    body.update(over)
    return body


def takedown_payload(**over):
    body = {
        "target_type": "review", "target_id": 1, "request_type": "delete", "requester_name": "홍길동",
        "requester_contact": "hong@example.com", "relation": "본인", "reason": "사실과 다른 내용이 게시되어 있습니다.",
    }
    body.update(over)
    return body
