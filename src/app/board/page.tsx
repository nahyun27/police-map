import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { Card, Crumb, PageHead, TableWrap } from '@/components/ui';
import { getRegions, listPosts, type PopularPeriod, type PostCategory } from '@/lib/api';
import { formatDate } from '@/lib/format';

type Props = {
  searchParams: Promise<{ region?: string; category?: string; sort?: string; period?: string; q?: string; page?: string }>;
};

const PAGE_SIZE = 20;
const CATEGORY_OPTIONS: [PostCategory, string][] = [
  ['info', '정보공유'], ['question', '질문'], ['chat', '잡담'], ['other', '기타'],
];
const PERIOD_OPTIONS: [PopularPeriod, string][] = [
  ['today', '오늘'], ['week', '주간'], ['month', '월간'], ['all', '전체'],
];

export const metadata: Metadata = { title: '커뮤니티 게시판' };

type Filters = { region?: string; category?: string; sort: string; period: string; q?: string; page?: number };

function buildHref(base: Filters) {
  const p = new URLSearchParams();
  if (base.region) p.set('region', base.region);
  if (base.category) p.set('category', base.category);
  if (base.sort !== 'new') p.set('sort', base.sort);
  if (base.sort === 'top' && base.period !== 'all') p.set('period', base.period);
  if (base.q) p.set('q', base.q);
  if (base.page && base.page > 1) p.set('page', String(base.page));
  const s = p.toString();
  return `/board${s ? `?${s}` : ''}`;
}

export default async function BoardPage({ searchParams }: Props) {
  const sp = await searchParams;
  const region = sp.region || undefined;
  const category = sp.category || undefined;
  const sort = sp.sort === 'top' ? 'top' : 'new';
  const period = (sp.period as PopularPeriod) || 'all';
  const q = sp.q || undefined;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const f: Filters = { region, category, sort, period, q };

  const [regions, posts] = await Promise.all([
    getRegions(),
    listPosts({ regionId: region, category: category as PostCategory | undefined, q, sort, page, size: PAGE_SIZE }),
  ]);
  const totalPages = Math.max(1, Math.ceil(posts.total / posts.size));

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: '커뮤니티 게시판' }]} />
      <PageHead
        eyebrow="커뮤니티"
        title="자유 게시판"
        sub="지역·경찰서 관련 자유로운 이야기를 나누는 공간입니다. 사실 적시 평가는 경찰서 평가 작성을 이용해 주세요."
      >
        <Link href="/board/write" className="btn sm" style={{ marginTop: 10 }}>글쓰기</Link>
      </PageHead>

      <Card className="flat">
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <Link href={buildHref({ ...f, region: undefined, page: 1 })} className={`btn sm ${!region ? '' : 'line'}`}>전체 지역</Link>
          {regions.map((r) => (
            <Link key={r.id} href={buildHref({ ...f, region: r.id, page: 1 })} className={`btn sm ${region === r.id ? '' : 'line'}`}>
              {r.name}
            </Link>
          ))}
        </div>
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <Link href={buildHref({ ...f, category: undefined, page: 1 })} className={`btn sm ${!category ? '' : 'line'}`}>전체 글머리</Link>
          {CATEGORY_OPTIONS.map(([v, l]) => (
            <Link key={v} href={buildHref({ ...f, category: v, page: 1 })} className={`btn sm ${category === v ? '' : 'line'}`}>{l}</Link>
          ))}
        </div>
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <Link href={buildHref({ ...f, sort: 'new', page: 1 })} className={`btn sm ${sort === 'new' ? '' : 'line'}`}>최신순</Link>
          <Link href={buildHref({ ...f, sort: 'top', page: 1 })} className={`btn sm ${sort === 'top' ? '' : 'line'}`}>인기순</Link>
          {sort === 'top' && PERIOD_OPTIONS.map(([v, l]) => (
            <Link key={v} href={buildHref({ ...f, sort: 'top', period: v, page: 1 })} className={`btn sm ${period === v ? '' : 'line'}`}>{l}</Link>
          ))}
        </div>
        <form action="/board" method="get" className="hsearch" style={{ maxWidth: 320 }}>
          {region && <input type="hidden" name="region" value={region} />}
          {category && <input type="hidden" name="category" value={category} />}
          {sort !== 'new' && <input type="hidden" name="sort" value={sort} />}
          {sort === 'top' && period !== 'all' && <input type="hidden" name="period" value={period} />}
          <Search size={16} />
          <input type="text" name="q" defaultValue={q} placeholder="제목·내용 검색" aria-label="게시판 검색" />
        </form>
      </Card>

      <Card>
        <TableWrap>
          <table className="list">
            <thead><tr><th>글머리</th><th>지역</th><th>제목</th><th>작성자</th><th>조회</th><th>추천</th><th>댓글</th><th>작성일</th></tr></thead>
            <tbody>
              {posts.items.length ? posts.items.map((p) => (
                <tr key={p.id}>
                  <td className="sub">{p.category_label}</td>
                  <td className="sub">{p.region_name}{p.station_name ? ` · ${p.station_name}` : ''}</td>
                  <td><Link href={`/board/${p.id}`}>{p.title}</Link></td>
                  <td className="sub">{p.author_nickname}</td>
                  <td className="sub">{p.view_count}</td>
                  <td className="sub">{p.score}</td>
                  <td className="sub">{p.comment_count}</td>
                  <td className="sub">{formatDate(p.created_at)}</td>
                </tr>
              )) : (
                <tr><td colSpan={8} className="sub">{q ? '검색 결과가 없습니다.' : '등록된 글이 없습니다. 첫 글을 남겨 보세요.'}</td></tr>
              )}
            </tbody>
          </table>
        </TableWrap>
        {totalPages > 1 && (
          <div className="btn-row" style={{ marginTop: 16, alignItems: 'center' }}>
            {page > 1 && <Link href={buildHref({ ...f, page: page - 1 })} className="btn line sm">이전</Link>}
            <span className="sub">{page} / {totalPages}</span>
            {page < totalPages && <Link href={buildHref({ ...f, page: page + 1 })} className="btn line sm">다음</Link>}
          </div>
        )}
      </Card>
    </>
  );
}
