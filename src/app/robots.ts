import type { MetadataRoute } from 'next';
import { ALLOW_INDEXING, SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  if (!ALLOW_INDEXING) return { rules: { userAgent: '*', disallow: '/' } };
  const disallow = [
    '/search', '/station/*/write', '/board/write', '/officer-verify', '/remedy/', '/report/', '/takedown',
    '/admin', '/mypage',
  ];
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow },
      // 머리글 로고(투명 배경)가 구글 이미지에서 검은 배경으로 잘려 대표 이미지처럼 뜨던 문제(2026-10).
      // 이미지 수집기에만 로고 파일을 막아, 대표 이미지는 공유 이미지(opengraph-image)가 잡히게 한다.
      // 이 그룹이 있으면 Googlebot-Image 는 * 그룹을 보지 않으므로 같은 차단 목록을 함께 적는다.
      {
        userAgent: 'Googlebot-Image', allow: '/',
        disallow: [...disallow, '/images/logo.webp', '/_next/image?url=%2Fimages%2Flogo.webp'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
