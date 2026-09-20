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
python -m scripts.seed          # 샘플 데이터 (전부 가상, 지역 18곳만 실제)
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
alembic/      마이그레이션      scripts/   seed, create_admin      tests/
```

## API 요약 (`/api/v1`)

| 구분 | 엔드포인트 |
| --- | --- |
| 공개 | `GET /regions` `/regions/{id}` `/stations/{id}` `/officers/{id}` `/reviews/recent` `/search?q=` `/stats/overview` |
| 인증 | `POST /auth/register` `/auth/login` `/auth/refresh` `/auth/logout`, `GET /auth/me` |
| 평가 | `POST /reviews`(로그인 필요, 항상 검수 대기로 저장), `GET /reviews/mine` |
| 당사자 | `POST /takedown-requests`(비회원 가능, **접수 즉시 임시조치**), `GET /takedown-requests/{code}` |
| 관리자 | `GET /admin/reviews` `POST .../approve` `.../reject`, `GET /admin/takedown-requests` `POST .../resolve`, `POST /admin/stations` `/admin/officers` `PATCH /admin/officers/{id}`, `GET /admin/audit-logs` |

전체 스펙은 서버 실행 후 `/docs`.

## 정책이 코드에서 지켜지는 방식

| 운영원칙 | 구현 |
| --- | --- |
| 전량 선검수 후 게시 | 평가는 항상 `pending` 으로 저장, 관리자 승인 전에는 공개 API·집계에서 제외 |
| 접수 즉시 임시조치 | `POST /takedown-requests` 가 같은 트랜잭션에서 대상을 `blinded` 로 전환 |
| 10일 내 재검토 | `due_at` 저장, 관리자 목록에 `overdue` 표시 |
| 운영진 개입 기록화 | 모든 관리자 조치·삭제 요청 접수가 `audit_logs` 에 기록(수정·삭제 API 없음) |
| 사건번호 비공개 | 공개·작성자 응답 스키마에 필드 자체가 없음. 중복 판별은 HMAC 해시로 |
| 직무 관련 정보만 게재 | 수사관 모델에 사진·연락처·사생활 컬럼이 없음, 출처(`source`) 필수 |
| 인신공격 표현 차단 | 서버에서 재검사(`core/moderation.py`) — 프론트 검사는 UX 용 |

## 알려진 한계 / 배포 전 할 일

- **본인인증 미연동**: `users.identity_verified_at` 만 준비됨. 연동 후 `REQUIRE_IDENTITY_VERIFICATION=true`.
- **이메일 인증·비밀번호 재설정 없음.**
- **알림 없음**: 삭제·정정 처리 결과를 양측에 통지하는 이메일 발송은 미구현(접수 코드 조회만 가능).
- **사건번호 평문 저장**: 운영 전 컬럼 암호화(또는 KMS) 필요.
- **속도 제한은 프로세스 메모리 기반**(단일 인스턴스 전제). Nginx 뒤에서는 `--proxy-headers` 로 실제 IP 를 받아야 함.
- **임시조치 남용 가능성**: 누구나 삭제 요청으로 게시물을 즉시 블라인드할 수 있는 구조(정책상 의도). 속도 제한과 기한 관리로 완화하며, 남용 패턴이 보이면 정책 조정 필요.
- **금칙어는 단순 포함 검사**: 우회·오탐 한계가 있어 사람 검수가 최종 관문.
- **실제 경찰서·수사관 데이터 없음**: 지역 18곳만 실제. 258개 경찰서 목록 적재 스크립트 필요.
- 운영 환경(`ENVIRONMENT=production`)에서는 기본 시크릿·비보안 쿠키로는 서버가 기동을 거부한다.
