# 폴리스맵 (PoliceMap)

국민 참여형 수사기관 평가 플랫폼 — 프로토타입을 React로 이식한 프로젝트입니다.

> ⚠ 현재 화면의 모든 관서·인물·평가·통계는 **가상의 샘플 데이터**입니다.

## 실행

```bash
npm install
npm run dev        # 개발 서버 (http://localhost:5173)
npm run build      # 타입체크 + 프로덕션 빌드
npm run preview    # 빌드 결과 미리보기
```

## 기술 스택

Vite · React 19 · TypeScript · React Router

## 구조

```
src/
  App.tsx            라우트 정의
  components/        Layout(헤더/푸터), 공용 UI(Stars, Bars, Crumb, Card)
  data/              타입 + 샘플 데이터 (추후 API로 교체)
  pages/             Home, Region, Station, Officer, Write, Stats, Guide, Remedy, Policy, Search
policemap_prototype.html   원본 단일 파일 프로토타입 (참고용)
```

## 라우트

| 경로 | 화면 |
| --- | --- |
| `/` | 지도 탐색(타일맵) |
| `/region/:id` → `/station/:id` → `/officer/:id` | 지역 → 경찰서 → 수사관 |
| `/officer/:id/write` | 평가 작성 |
| `/stats` `/guide` `/remedy[/:officerId]` `/policy` | 통계 · 권리구제 안내 · 내비게이터 · 운영원칙 |
| `/search?q=` | 검색 |
