import type { Metadata } from 'next';
import Link from 'next/link';
import { PenLine, Search } from 'lucide-react';
import { Card, Crumb, PageHead } from '@/components/ui';
import { RegionFilterSelect } from '@/components/RegionFilterSelect';
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

  let failed = false;
  const [regions, posts] = await Promise.all([
    getRegions().catch(() => []),
    listPosts({ regionId: region, category: category as PostCategory | undefined, q, sort, page, size: PAGE_SIZE })
      .catch(() => { failed = true; return { items: [], total: 0, page: 1, size: PAGE_SIZE }; }),
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
        <Link href="/board/write" className="btn sm pagehead-write-inline" style={{ marginTop: 10 }}>글쓰기</Link>
      </PageHead>

      <nav className="cat-tabs" aria-label="글머리 선택">
        <Link href={buildHref({ ...f, category: undefined, page: 1 })} className={!category ? 'on' : ''}>전체</Link>
        {CATEGORY_OPTIONS.map(([v, l]) => (
          <Link key={v} href={buildHref({ ...f, category: v, page: 1 })} className={category === v ? 'on' : ''}>{l}</Link>
        ))}
      </nav>

      <Card className="flat">
        <div className="btn-row" style={{ marginBottom: 10 }}>
          <RegionFilterSelect regions={regions} value={region ?? ''} category={category} sort={sort} period={period} q={q} />
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
        {posts.items.length ? (
          <div className="post-list">
            {posts.items.map((p) => (
              <Link href={`/board/${p.id}`} key={p.id} className="post-row">
                <div className="post-row-top">
                  <span className={`badge cat-${p.category}`}>{p.category_label}</span>
                  <span className="sub">{p.region_name}{p.station_name ? ` · ${p.station_name}` : ''}</span>
                </div>
                <div className="post-row-title">{p.title}</div>
                <div className="post-row-meta sub">
                  <span>{p.author_nickname}</span>
                  <span>{formatDate(p.created_at)}</span>
                  <span>조회 {p.view_count}</span>
                  <span>추천 {p.score}</span>
                  <span>댓글 {p.comment_count}</span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <p className="sub">
            {failed ? '목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' : q ? '검색 결과가 없습니다.' : '등록된 글이 없습니다. 첫 글을 남겨 보세요.'}
          </p>
        )}
        {totalPages > 1 && (
          <div className="btn-row" style={{ marginTop: 16, alignItems: 'center' }}>
            {page > 1 && <Link href={buildHref({ ...f, page: page - 1 })} className="btn line sm">이전</Link>}
            <span className="sub">{page} / {totalPages}</span>
            {page < totalPages && <Link href={buildHref({ ...f, page: page + 1 })} className="btn line sm">다음</Link>}
          </div>
        )}
      </Card>

      <Link href="/board/write" className="fab-write" aria-label="글쓰기">
        <PenLine size={22} /><span>글쓰기</span>
      </Link>
    </>
  );
}
