import type { MetadataRoute } from 'next';
import { getRegion, getRegions, listPosts } from '@/lib/api';
import { SITE_URL } from '@/lib/seo';

// 사이트맵에 넣을 게시글은 최신 순으로 이 페이지 수까지만(50건×20쪽=최대 1000건) — 글이
// 무한히 쌓여도 사이트맵 생성 시간이 같이 늘어나지 않게 상한을 둔다.
const MAX_POST_PAGES = 20;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const fixed = ['', '/board', '/why', '/stats', '/remedy', '/report', '/policy'];
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
  try {
    for (let page = 1; page <= MAX_POST_PAGES; page++) {
      const posts = await listPosts({ sort: 'new', page, size: 50 });
      entries.push(...posts.items.map((p) => ({ url: `${SITE_URL}/board/${p.id}` })));
      if (page * posts.size >= posts.total) break;
    }
  } catch {
    // 게시글 쪽만 실패해도 나머지 사이트맵은 그대로 내보낸다.
  }
  return entries;
}
