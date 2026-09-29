# 폴리스맵 (PoliceMap)

국민 참여형 수사기관 평가 플랫폼.

> ⚠ 개발 중인 프로토타입입니다. 경찰서 정보는 경찰청 공개자료를 기반으로 하지만, 평가·통계 일부는 테스트용 샘플입니다.

## 백엔드

FastAPI + PostgreSQL API 는 [backend/](backend/) 에 있다. 실행 방법·API·정책 구현은 [backend/README.md](backend/README.md) 참고.
프론트는 이 API 로 실제 경찰서 데이터(263곳)를 그린다 — 먼저 백엔드를 띄워야 프론트가 정상 동작한다.

## 프론트엔드 실행

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_API_BASE_URL 이 백엔드 주소(기본 :8001)를 가리키는지 확인
npm run dev        # 개발 서버 (http://localhost:3000)
npm run build      # 프로덕션 빌드 (타입체크 포함, 빌드 시점에 백엔드가 떠 있어야 한다 — 아래 "빌드 시 주의" 참고)
npm run start      # 빌드 결과 실행
```

백엔드가 꺼져 있으면 데이터가 필요한 페이지는 에러 화면(`src/app/error.tsx`)을 보여준다. `npm run dev` 는 그 상태로도
뜨지만(요청마다 다시 fetch 하므로 백엔드를 나중에 띄워도 새로고침하면 정상화된다), `npm run build` 는 라우트를
정적/동적으로 분류하는 과정에서 일부 페이지를 실제로 렌더링해 보므로 백엔드가 응답해야 한다.

## 기술 스택

Next.js 16 (App Router) · React 19 · TypeScript. 백엔드는 별도 서버(FastAPI, `backend/`)이며 이 앱은 순수 클라이언트다 — DB 를 직접 붙지 않는다.

## 환경변수

`.env.example` 참고.

| 변수 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | 백엔드 API 주소. 기본 `http://localhost:8001`(backend/README.md 의 개발 포트와 일치해야 한다) |
| `NEXT_PUBLIC_SITE_URL` | 공개 주소 (메타태그·sitemap 기준). 기본 `http://localhost:3000` |
| `NEXT_PUBLIC_ALLOW_INDEXING` | 검색엔진 색인 허용. **기본은 차단(noindex)**. 실데이터로 정식 오픈할 때만 `true` |

색인 정책은 [src/lib/seo.ts](src/lib/seo.ts)에서 한곳에 관리한다. `NEXT_PUBLIC_*` 값은 빌드 시점에 고정되므로 변경 후 재빌드가 필요하다.

백엔드의 `CORS_ORIGINS` 는 기본값이 `http://localhost:3000` 이다 — 프론트를 다른 포트로 띄우면 브라우저에서의 평가
제출(`POST /reviews`, 클라이언트 컴포넌트에서 직접 호출)이 CORS 에 막힌다. 포트를 바꿔야 한다면 백엔드 `.env` 의
`CORS_ORIGINS` 도 함께 맞출 것.

## 구조

```
src/
  app/               라우트 (App Router). 데이터를 쓰는 페이지는 force-dynamic, 페이지별 metadata
  components/        Header/Footer, 공용 UI(ui.tsx), 클라이언트 컴포넌트(WriteForm, RemedyNavigator 등)
  data/sample.ts      권리구제 안내·게시 금칙어 등 정적 콘텐츠(경찰서·평가는 더 이상 여기 없음)
  lib/api.ts         백엔드 API 클라이언트 — 타입은 backend 의 Pydantic 스키마와 1:1
  lib/seo.ts         색인 정책      lib/format.ts  날짜 포맷      lib/tileLayout.ts  홈 지도 타일 배치
policemap_prototype.html   원본 단일 파일 프로토타입 (참고용)
```

서버 컴포넌트가 기본이고, 상호작용이 필요한 곳(헤더 검색, 평가 작성 폼, 권리구제 내비게이터, 클릭 가능한 표 행)만
`"use client"` 로 분리했다. 데이터를 쓰는 페이지는 백엔드 상태를 실시간으로 반영해야 하므로 정적 생성 대상에서 빼고
(`export const dynamic = 'force-dynamic'`) 매 요청마다 서버에서 다시 그린다.

## 라우트

| 경로 | 화면 |
| --- | --- |
| `/` | 지도 탐색(타일맵), 최근 평가, 전체 통계 요약 |
| `/region/:id` → `/station/:id` | 지역 → 경찰서 상세(주소·부서·평가 목록, 페이지네이션) |
| `/station/:id/write` | 평가 작성(로그인 불필요) |
| `/stats` `/guide` `/remedy[/:stationId]` `/policy` | 통계 · 권리구제 안내 · 내비게이터 · 운영원칙 |
| `/search?q=` | 경찰서 검색 |

수사관 개인 단위 화면은 없다 — 평가는 경찰서 단위로만 받는다(2026-09 의뢰인 결정, 사유는 [backend/README.md](backend/README.md) 참고).
