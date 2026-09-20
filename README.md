# 폴리스맵 (PoliceMap)

국민 참여형 수사기관 평가 플랫폼 — 프로토타입을 React로 이식한 프로젝트입니다.

> ⚠ 현재 화면의 모든 관서·인물·평가·통계는 **가상의 샘플 데이터**입니다.

## 백엔드

FastAPI + PostgreSQL API 는 [backend/](backend/) 에 있다. 실행 방법·API·정책 구현은 [backend/README.md](backend/README.md) 참고.
프론트는 아직 샘플 데이터(`src/data/sample.ts`)를 쓰며, API 연동은 다음 단계다.

## 프론트엔드 실행

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:3000)
npm run build      # 프로덕션 빌드 (타입체크 포함)
npm run start      # 빌드 결과 실행
```

## 기술 스택

Next.js 16 (App Router) · React 19 · TypeScript

## 환경변수

`.env.example` 참고. 로컬에서는 설정하지 않아도 동작한다.

| 변수 | 설명 |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | 공개 주소 (메타태그·sitemap 기준). 기본 `http://localhost:3000` |
| `NEXT_PUBLIC_ALLOW_INDEXING` | 검색엔진 색인 허용. **기본은 차단(noindex)**. 실데이터로 정식 오픈할 때만 `true` |

색인 정책은 [src/lib/seo.ts](src/lib/seo.ts)에서 한곳에 관리한다. 수사관 개인 페이지(`/officer/*`)는
`INDEX_OFFICER_PAGES` 가 `false` 인 동안 `ALLOW_INDEXING` 과 무관하게 항상 noindex 다(실명 게재 분쟁 위험, 정책 확정 전).
`NEXT_PUBLIC_*` 값은 빌드 시점에 고정되므로 변경 후 재빌드가 필요하다.

## 구조

```
src/
  app/               라우트 (App Router). 페이지별 metadata, robots.ts, sitemap.ts
  components/        Header/Footer, 공용 UI(ui.tsx), 클라이언트 컴포넌트(WriteForm, RemedyNavigator 등)
  data/              타입 + 샘플 데이터 (추후 API로 교체)
  lib/seo.ts         색인 정책
policemap_prototype.html   원본 단일 파일 프로토타입 (참고용)
```

서버 컴포넌트가 기본이고, 상호작용이 필요한 곳(헤더 검색, 평가 작성 폼, 권리구제 내비게이터, 클릭 가능한 표 행)만
`"use client"` 로 분리했다. 덕분에 검색엔진이 읽는 HTML 에 본문이 그대로 들어간다.

## 라우트

| 경로 | 화면 |
| --- | --- |
| `/` | 지도 탐색(타일맵) |
| `/region/:id` → `/station/:id` → `/officer/:id` | 지역 → 경찰서 → 수사관 |
| `/officer/:id/write` | 평가 작성 |
| `/stats` `/guide` `/remedy[/:officerId]` `/policy` | 통계 · 권리구제 안내 · 내비게이터 · 운영원칙 |
| `/search?q=` | 검색 |
