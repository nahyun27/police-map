/**
 * 검색엔진 색인 정책 — 한곳에서 관리한다.
 * ALLOW_INDEXING 이 false(기본값)면 사이트 전체가 noindex 다. 실데이터로 정식 오픈할 때만 true 로 켠다.
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
export const ALLOW_INDEXING = process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true';

export const NOINDEX = { index: false, follow: false } as const;

export const SITE_NAME = '폴리스맵';

/** 페이지 메타데이터 공통 틀. 대표 주소(canonical)를 SITE_URL(policemap.co.kr) 기준으로 박아,
 * policemap.kr(Cloudflare)로 들어온 같은 페이지를 검색엔진이 중복으로 보지 않게 한다.
 * openGraph 는 하위 페이지에서 지정하면 상위(layout) 값을 통째로 덮어쓰므로 siteName·locale·url 을
 * 여기서 매번 함께 채운다(빠지면 공유 미리보기의 사이트 이름·주소가 사라지거나 홈 주소로 나간다). */
export function pageMeta({ title, description, path }: { title: string; description: string; path: string }) {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} | ${SITE_NAME}`, description, url: path, siteName: SITE_NAME, locale: 'ko_KR', type: 'website' as const,
      // 루트의 opengraph-image 는 openGraph 를 직접 지정한 페이지에는 이어지지 않아 같은 이미지를 명시한다.
      images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: SITE_NAME }],
    },
  };
}
