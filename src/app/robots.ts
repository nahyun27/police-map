import type { MetadataRoute } from 'next';
import { ALLOW_INDEXING, SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  if (!ALLOW_INDEXING) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: {
      userAgent: '*', allow: '/',
      disallow: [
        '/search', '/station/*/write', '/board/write', '/officer-verify', '/remedy/', '/report/', '/takedown',
        '/admin', '/mypage',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
