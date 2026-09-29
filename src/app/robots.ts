import type { MetadataRoute } from 'next';
import { ALLOW_INDEXING, SITE_URL } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  if (!ALLOW_INDEXING) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/search', '/station/*/write', '/remedy/', '/takedown', '/admin'] },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
