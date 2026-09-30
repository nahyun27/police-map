import type { MetadataRoute } from 'next';
import { getRegion, getRegions } from '@/lib/api';
import { SITE_URL } from '@/lib/seo';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed = ['', '/why', '/stats', '/guide', '/remedy', '/report', '/policy'];
  const entries: MetadataRoute.Sitemap = fixed.map((p) => ({ url: `${SITE_URL}${p}` }));
  try {
    const regions = await getRegions();
    entries.push(...regions.map((r) => ({ url: `${SITE_URL}/region/${r.id}` })));
    const details = await Promise.all(regions.map((r) => getRegion(r.id)));
    for (const d of details) {
      entries.push(...d.stations.map((s) => ({ url: `${SITE_URL}/station/${s.id}` })));
    }
  } catch {
    // 생성 시점에 백엔드에 연결할 수 없으면 고정 경로만 포함한다.
  }
  return entries;
}
