import type { Metadata } from 'next';
import Link from 'next/link';
import { Eye, MessageSquare, PenLine, Search, Star, ThumbsDown, ThumbsUp } from 'lucide-react';
import { Card, Crumb, PageHead } from '@/components/ui';
import { CategoryTabs } from '@/components/CategoryTabs';
import { RegionFilterSelect } from '@/components/RegionFilterSelect';
import { getRegions, listBoardFeed, type BoardFeedCategory, type PopularPeriod } from '@/lib/api';
import { formatDate } from '@/lib/format';

type Props = {
  searchParams: Promise<{ region?: string; category?: string; sort?: string; period?: string; q?: string; page?: string }>;
};

const PAGE_SIZE = 20;
// '평가' 는 게시글 카테고리가 아니라 평가를 가리키는 가상 카테고리다(2026-10 결정: 의뢰인 요청으로
// 커뮤니티 "전체" 피드에 평가도 섞어서 보여주고, 탭으로 평가만 걸러볼 수도 있게 함).
const CATEGORY_OPTIONS: [BoardFeedCategory, string][] = [
  ['info', '정보공유'], ['question', '질문'], ['chat', '잡담'], ['other', '기타'], ['review', '평가'],
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
  const [regions, feed] = await Promise.all([
    getRegions().catch(() => []),
    listBoardFeed({ regionId: region, category: category as BoardFeedCategory | undefined, q, sort, period, page, size: PAGE_SIZE })
      .catch(() => { failed = true; return { items: [], total: 0, page: 1, size: PAGE_SIZE }; }),
  ]);
  const totalPages = Math.max(1, Math.ceil(feed.total / feed.size));

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: '커뮤니티 게시판' }]} />
      <PageHead
        eyebrow="커뮤니티"
        title="자유 게시판"
        sub="지역·경찰서 관련 자유로운 이야기를 나누는 공간입니다. 사실 적시 평가는 경찰서 평가 작성을 이용해 주세요."
        actions={<Link href="/board/write" className="btn sm pagehead-write-inline">글쓰기</Link>}
      />

      <CategoryTabs
        active={category ?? ''}
        tabs={[
          { key: '', label: '전체', href: buildHref({ ...f, category: undefined, page: 1 }) },
          ...CATEGORY_OPTIONS.map(([v, l]) => ({ key: v, label: l, href: buildHref({ ...f, category: v, page: 1 }) })),
        ]}
      />

      <Card className="flat">
        <div className="btn-row" style={{ marginBottom: 10, alignItems: 'center' }}>
          <form action="/board" method="get" className="hsearch" style={{ marginLeft: 0 }}>
            {region && <input type="hidden" name="region" value={region} />}
            {category && <input type="hidden" name="category" value={category} />}
            {sort !== 'new' && <input type="hidden" name="sort" value={sort} />}
            {sort === 'top' && period !== 'all' && <input type="hidden" name="period" value={period} />}
            <Search size={16} />
            <input type="text" name="q" defaultValue={q} placeholder="제목·내용 검색" aria-label="게시판 검색" />
          </form>
          <div className="btn-row board-filter-group">
            <RegionFilterSelect regions={regions} value={region ?? ''} category={category} sort={sort} period={period} q={q} />
            <div className="seg">
              <Link href={buildHref({ ...f, sort: 'new', page: 1 })} className={sort === 'new' ? 'active' : ''}>최신순</Link>
              <Link href={buildHref({ ...f, sort: 'top', page: 1 })} className={sort === 'top' ? 'active' : ''}>인기순</Link>
            </div>
            {sort === 'top' && (
              <div className="seg">
                {PERIOD_OPTIONS.map(([v, l]) => (
                  <Link key={v} href={buildHref({ ...f, sort: 'top', period: v, page: 1 })} className={period === v ? 'active' : ''}>{l}</Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card>
        {feed.items.length ? (
          <>
            <div className="post-list-head sub">전체 {feed.total}건</div>
            <div className="post-list">
              {feed.items.map((it) => (
                <Link
                  href={it.kind === 'review' ? `/board/review/${it.id}` : `/board/${it.id}`}
                  key={`${it.kind}-${it.id}`} className="post-row"
                >
                  <div className="post-row-top">
                    <span className={`badge cat-${it.category}`}>{it.category_label}</span>
                    <span className="sub">{it.region_name ?? '전체'}{it.station_name ? ` · ${it.station_name}` : ''}</span>
                  </div>
                  {it.kind === 'review' ? (
                    <div className="post-row-title">
                      <Star size={13} style={{ verticalAlign: -2, marginRight: 4, color: 'var(--star)' }} fill="var(--star)" />
                      {it.overall?.toFixed(1) ?? '-'} · {it.role_label} · {it.body ? it.body.slice(0, 60) + (it.body.length > 60 ? '…' : '') : '(서술 없음, 별점만 등록)'}
                    </div>
                  ) : (
                    <div className="post-row-title">{it.title}</div>
                  )}
                  <div className="post-row-meta">
                    <span className="who">{it.kind === 'review' ? it.role_label : it.author_nickname}</span>
                    <span className="sub">{formatDate(it.created_at)}</span>
                    {it.kind === 'post' && <span className="stat"><Eye size={12} />{it.view_count}</span>}
                    <span className="stat"><ThumbsUp size={12} />{it.up}</span>
                    <span className="stat"><ThumbsDown size={12} />{it.down}</span>
                    <span className="stat"><MessageSquare size={12} />{it.comment_count}</span>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p className="sub">
            {failed ? '목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
              : q ? '검색 결과가 없습니다.'
              : category === 'review' ? <>아직 등록된 평가가 없습니다. <Link href="/search?intent=write">평가 작성하기</Link></>
              : '등록된 글이 없습니다. 첫 글을 남겨 보세요.'}
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
