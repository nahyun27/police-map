import type { MetadataRoute } from 'next';
import { REGIONS, STATIONS } from '@/data/sample';
import { SITE_URL } from '@/lib/seo';

// 수사관 개인 페이지는 색인 정책이 정해질 때까지 sitemap 에 넣지 않는다(src/lib/seo.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const fixed = ['', '/stats', '/guide', '/remedy', '/policy'];
  return [
    ...fixed.map((p) => ({ url: `${SITE_URL}${p}` })),
    ...REGIONS.map((r) => ({ url: `${SITE_URL}/region/${r.id}` })),
    ...STATIONS.map((s) => ({ url: `${SITE_URL}/station/${s.id}` })),
  ];
}
