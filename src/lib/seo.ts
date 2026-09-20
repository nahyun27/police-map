/**
 * 검색엔진 색인 정책 — 한곳에서 관리한다.
 * - ALLOW_INDEXING: 사이트 전체 색인 허용. 기본 false(데모·가상 데이터 단계에서는 노출 금지).
 * - INDEX_OFFICER_PAGES: 수사관 개인 페이지 색인 허용. 실명 게재로 인한 분쟁 위험이 있어
 *   의뢰인과 정책이 정해지기 전까지 false 로 둔다.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
export const ALLOW_INDEXING = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true';
export const INDEX_OFFICER_PAGES = false;

export const NOINDEX = { index: false, follow: false } as const;

export const officerRobots = ALLOW_INDEXING && INDEX_OFFICER_PAGES ? { index: true, follow: true } : NOINDEX;
