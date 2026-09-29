# PoliceMap Backend

FastAPI + SQLAlchemy 2.0 + Alembic + PostgreSQL. 구조와 규칙은 kcpec-platform 백엔드를 따른다.

## 실행

```bash
# 저장소 루트: 개발용 DB (Postgres 16, 포트 5433 — kcpec 의 5432 와 충돌하지 않음)
docker compose up -d

cd backend
python3.11 -m venv venv && source venv/bin/activate
pip install -r requirements-dev.txt
cp .env.example .env

alembic upgrade head            # 스키마 생성
python -m scripts.seed          # 샘플 데이터 (지역 18곳 + 가상 경찰서·수사관·평가 5건씩)
python -m scripts.import_stations   # 전국 경찰서 실데이터 263곳(data/police_stations.json) — 멱등적, 반복 실행 가능
python -m scripts.create_admin --email you@example.com   # 관리자 계정(비밀번호는 프롬프트 입력)

uvicorn app.main:app --reload --port 8001     # http://localhost:8001/docs (Swagger)
pytest                          # 테스트 (인메모리 SQLite — 개발 DB 를 건드리지 않음)
```

## 구조

```
app/
  core/       설정, DB, 보안(JWT·bcrypt·사건번호 HMAC), 쿠키, 의존성, 속도 제한, 금칙어
  models/     SQLAlchemy 모델
  schemas/    Pydantic 요청·응답 스키마
  services/   평점 집계, 삭제·정정 처리, 감사 로그
  api/v1/     public / auth / reviews / takedown / admin
alembic/      마이그레이션      scripts/   seed, import_stations, create_admin      tests/
data/         전국 경찰관서 실데이터(공개 자료, 출처는 data/README.md)
```

## API 요약 (`/api/v1`)

| 구분 | 엔드포인트 |
| --- | --- |
| 공개 | `GET /regions` `/regions/{id}` `/stations/{id}` `/reviews/recent` `/search?q=` `/stats/overview` |
| 인증 | `POST /auth/register` `/auth/login` `/auth/refresh` `/auth/logout`, `GET /auth/me` — 현재는 관리자 로그인에만 쓰인다(아래 정책 표 참고) |
| 평가 | `POST /reviews`(**로그인 없이 익명 작성**, 항상 검수 대기로 저장) |
| 당사자 | `POST /takedown-requests`(비회원 가능, **접수 즉시 임시조치**), `GET /takedown-requests/{code}` |
| 관리자 | `GET /admin/reviews` `POST .../approve` `.../reject`, `GET /admin/takedown-requests` `POST .../resolve`, `POST /admin/stations` `/admin/officers` `PATCH /admin/officers/{id}`, `GET /admin/audit-logs` |

전체 스펙은 서버 실행 후 `/docs`.

## 정책이 코드에서 지켜지는 방식

| 운영원칙 | 구현 |
| --- | --- |
| 평가는 경찰서 단위 | `Review.station_id`(NOT NULL). 수사관 개인 단위는 의뢰인 결정(2026-09)으로 보류 — 아래 참고 |
| 기본 비로그인 익명 작성 | `POST /reviews` 에 인증 의존성이 없음. 남용 방지는 IP 기준 속도 제한(`core/rate_limit.py`)만 |
| 전량 선검수 후 게시 | 평가는 항상 `pending` 으로 저장, 관리자 승인 전에는 공개 API·집계에서 제외 |
| 접수 즉시 임시조치 | `POST /takedown-requests` 가 같은 트랜잭션에서 대상을 `blinded` 로 전환 |
| 10일 내 재검토 | `due_at` 저장, 관리자 목록에 `overdue` 표시 |
| 운영진 개입 기록화 | 모든 관리자 조치·삭제 요청 접수가 `audit_logs` 에 기록(수정·삭제 API 없음) |
| 사건번호는 선택 입력·비공개 | 공개·관리자 응답 스키마 모두 원문을 평문으로 반환하지 않는 곳(공개 API)에는 필드 자체가 없음. 중복 판별은 HMAC 해시로, 미입력 시 건너뜀 |
| 직무 관련 정보만 게재 | 수사관 모델에 사진·연락처·사생활 컬럼이 없음, 출처(`source`) 필수 |
| 인신공격 표현 차단 | 서버에서 재검사(`core/moderation.py`) — 프론트 검사는 UX 용 |

## 수사관 개인 단위는 보류 중 (2026-09 의뢰인 결정)

평가는 당분간 경찰서 단위로만 받는다. `Officer`/`OfficerAssignment` 모델과 관리자 CRUD(`POST /admin/officers`,
`PATCH /admin/officers/{id}`)는 남아 있지만, **공개 API·프론트에는 수사관이 전혀 노출되지 않는다** —
`GET /officers/{id}` 같은 공개 조회 엔드포인트 자체가 없다. 개인 단위 평가를 재도입할 때는:

1. `Review` 에 `officer_id`(nullable) 를 다시 추가하고, 집계(`services/ratings.py`)에 수사관 단위 그룹핑을 추가
2. 공개 조회 API·스키마(`OfficerDetail` 등, 이전 커밋에 있던 형태) 복원
3. 관리자가 미리 등록해 둔 `Officer` 데이터를 그대로 활용 가능(스키마가 안 바뀌었으므로)

## 인증은 지금 관리자 전용이다

로그인·회원가입 API(`/auth/*`)는 남아 있지만 현재 관리자 로그인에만 쓰인다. 의뢰인 결정(2026-09): "기본은
비로그인 익명, 회원가입·로그인은 향후 과금 단계에서만". `Review.author_id` 는 그 미래를 위해 nullable 로
남겨 뒀을 뿐 지금은 항상 `NULL` 이다 — 로그인 붙는 시점에 `POST /reviews` 를 `get_current_user` 로 감싸고
이 컬럼을 채우면 된다(마이그레이션 불필요).

## 알려진 한계 / 배포 전 할 일

- **이메일 인증·비밀번호 재설정 없음**(관리자 계정용으로도).
- **알림 없음**: 삭제·정정 처리 결과를 양측에 통지하는 이메일 발송은 미구현(접수 코드 조회만 가능).
- **사건번호 평문 저장**: 운영 전 컬럼 암호화(또는 KMS) 필요.
- **속도 제한은 프로세스 메모리 기반**(단일 인스턴스 전제, IP 키). Nginx 뒤에서는 `--proxy-headers` 로 실제 IP 를 받아야 하고,
  여러 인스턴스로 늘리면 Redis 등 공유 저장소로 바꿔야 한다. 익명 작성 전환으로 이 속도 제한이 유일한 도배 방지 수단이 됐다.
- **임시조치 남용 가능성**: 누구나 삭제 요청으로 게시물을 즉시 블라인드할 수 있는 구조(정책상 의도). 속도 제한과 기한 관리로 완화하며, 남용 패턴이 보이면 정책 조정 필요.
- **금칙어는 단순 포함 검사**: 우회·오탐 한계가 있어 사람 검수가 최종 관문.
- **경찰서 자체의 삭제·정정 절차 없음**: 주소·부서 등 관서 정보 오류는 현재 관리자가 `PATCH` 로 직접 고치는 것 외엔 신고 경로가 없다.
- 운영 환경(`ENVIRONMENT=production`)에서는 기본 시크릿·비보안 쿠키로는 서버가 기동을 거부한다.
