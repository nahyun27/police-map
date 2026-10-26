import { getRecentReviews, listPosts, type PostOut, type RecentReview } from '@/lib/api';
import { SITE_NAME, SITE_URL } from '@/lib/seo';

// 네이버 서치어드바이저 "RSS 제출"용 새 글 목록. 검색엔진이 주기적으로 읽어 새 글을 빨리 가져가게 한다.
// 검색에 노출하는 글만 넣는다: 커뮤니티 게시글과 경찰서 평가(경찰서 페이지로 연결). 사건 공론화는
// 검색 노출을 막아 둔 글이라(src/app/cases/[id]/page.tsx 의 NOINDEX) 넣지 않는다.
export const revalidate = 600;

const POST_LIMIT = 30;
const REVIEW_LIMIT = 20; // 백엔드 /reviews/recent 의 최대값

type Item = { title: string; link: string; guid: string; description: string; date: string | null };

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function excerpt(s: string, n = 200) {
  const t = s.replace(/\s+/g, ' ').trim();
  return t.length > n ? `${t.slice(0, n)}…` : t;
}

const fromPost = (p: PostOut): Item => ({
  title: p.title,
  link: `${SITE_URL}/board/${p.id}`,
  guid: `post-${p.id}`,
  description: `[${p.category_label}${p.station_name ? ` · ${p.station_name}` : p.region_name ? ` · ${p.region_name}` : ''}] ${excerpt(p.body)}`,
  date: p.created_at,
});

// 평가는 따로 주소가 없어 해당 경찰서 페이지로 연결한다. 수사관 이름은 API 에서 이미 일부 가려져 온다.
const fromReview = (r: RecentReview): Item => ({
  title: `${r.station_name} 수사 평가${r.overall !== null ? ` (${r.overall.toFixed(1)}점)` : ''}`,
  link: `${SITE_URL}/station/${r.station_id}`,
  guid: `review-${r.id}`,
  description: `[${r.role_label} · ${r.case_type_label}${r.target_label ? ` · ${r.target_label}` : ''}] ${r.body ? excerpt(r.body) : '별점만 등록된 평가입니다.'}`,
  date: r.published_at,
});

export async function GET() {
  const [posts, reviews] = await Promise.all([
    listPosts({ sort: 'new', size: POST_LIMIT }).then((p) => p.items).catch(() => [] as PostOut[]),
    getRecentReviews(REVIEW_LIMIT).catch(() => [] as RecentReview[]),
  ]);
  const items = [...posts.map(fromPost), ...reviews.map(fromReview)]
    .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

  const body = items.map((it) => `    <item>
      <title>${esc(it.title)}</title>
      <link>${esc(it.link)}</link>
      <guid isPermaLink="false">${SITE_URL}/#${it.guid}</guid>
      <description>${esc(it.description)}</description>${it.date ? `
      <pubDate>${new Date(it.date).toUTCString()}</pubDate>` : ''}
    </item>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(SITE_NAME)}: 경찰서·수사관 평가와 수사 후기</title>
    <link>${SITE_URL}/</link>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml" />
    <description>전국 경찰서·수사부서에 대한 국민 참여형 평가와 수사 경험 후기, 커뮤니티 새 글.</description>
    <language>ko</language>
${body}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
}
