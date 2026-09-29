/**
 * 검색엔진 색인 정책 — 한곳에서 관리한다.
 * ALLOW_INDEXING 이 false(기본값)면 사이트 전체가 noindex 다. 실데이터로 정식 오픈할 때만 true 로 켠다.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
export const ALLOW_INDEXING = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true';

export const NOINDEX = { index: false, follow: false } as const;
