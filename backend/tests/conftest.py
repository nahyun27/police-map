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

from app.core.config import settings  # noqa: E402
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
    settings.REQUIRE_IDENTITY_VERIFICATION = False
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
    """지역 1 · 경찰서 1 · 부서 2 · 수사관 2(A: 평가 2건 게시, B: 평가 없음)."""
    db.add(Region(id="seoul", name="서울", full_name="서울경찰청", station_total=31))
    st = Station(region_id="seoul", name="테스트경찰서", is_sample=True)
    db.add(st)
    db.flush()
    d1, d2 = Department(station_id=st.id, name="수사과"), Department(station_id=st.id, name="사이버수사팀")
    db.add_all([d1, d2])
    db.flush()
    a = Officer(station_id=st.id, department_id=d1.id, name="가상갑", rank="경위", source=OfficerSource.announcement)
    b = Officer(station_id=st.id, department_id=d2.id, name="가상을", rank="경사", source=OfficerSource.homepage)
    db.add_all([a, b])
    author = User(email="seed@example.invalid", password_hash="x", nickname="seed")
    db.add(author)
    db.flush()
    reviews = []
    for i, (stars, when) in enumerate([(3, 5), (4, 7)]):
        r = Review(
            officer_id=a.id, author_id=author.id, role=ReviewRole.complainant, case_type=CaseType.fraud,
            case_number=f"CASE-{i}", case_number_hash=hash_case_number(f"CASE-{i}"),
            fair=stars, proc=stars, att=stars, comm=stars, speed=stars, body=f"후기 {i}",
            status=ReviewStatus.published, published_at=datetime(2026, when, 1, tzinfo=timezone.utc),
        )
        db.add(r)
        reviews.append(r)
    db.commit()
    return {"station": st, "a": a, "b": b, "reviews": reviews, "author": author}


def review_payload(officer_id: int, **over):
    body = {
        "officer_id": officer_id, "role": "complainant", "case_type": "fraud", "case_number": "2026-형제-12345",
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
