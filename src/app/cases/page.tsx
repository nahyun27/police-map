import type { Metadata } from 'next';
import Link from 'next/link';
import { Eye, Heart, History, PenLine, Search } from 'lucide-react';
import { CategoryTabs } from '@/components/CategoryTabs';
import { Card, Crumb, PageHead } from '@/components/ui';
import { CASE_CATEGORIES, listCases, type CaseCategory } from '@/lib/api';
import { formatDate } from '@/lib/format';

export const metadata: Metadata = {
  title: '사건 공론화',
  description: '수사 과정에서 겪은 일을 기록하고, 시민들과 함께 살펴보세요.',
};

type Props = { searchParams: Promise<{ category?: string; sort?: string; q?: string; page?: string }> };
type Filters = { category?: string; sort: string; q?: string; page?: number };
const PAGE_SIZE = 20;

function buildHref(f: Filters) {
  const p = new URLSearchParams();
  if (f.category) p.set('category', f.category);
  if (f.sort !== 'new') p.set('sort', f.sort);
  if (f.q) p.set('q', f.q);
  if (f.page && f.page > 1) p.set('page', String(f.page));
  return `/cases${p.toString() ? `?${p}` : ''}`;
}

export default async function CasesPage({ searchParams }: Props) {
  const sp = await searchParams;
  const category = CASE_CATEGORIES.some(([v]) => v === sp.category) ? (sp.category as CaseCategory) : undefined;
  const sort = sp.sort === 'empathy' ? 'empathy' : 'new';
  const q = sp.q || undefined;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const f: Filters = { category, sort, q };

  let failed = false;
  const data = await listCases({ category, sort, q, page, size: PAGE_SIZE })
    .catch(() => { failed = true; return { items: [], total: 0, page: 1, size: PAGE_SIZE }; });
  const totalPages = Math.max(1, Math.ceil(data.total / data.size));

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: '사건 공론화' }]} />
      <PageHead
        eyebrow="사건 공론화"
        title="혼자 겪은 일을, 함께 살펴볼 수 있도록"
        sub="수사 과정에서 겪은 의문과 부당함을 기록하고 시민들의 공감을 모아 보세요. 이후의 민원 처리 결과까지 이어서 기록할 수 있습니다."
        actions={<Link href="/cases/new" className="btn sm pagehead-write-inline">내 사건 기록하기</Link>}
      />

      <Card className="tint">
        폴리스맵은 사건의 진실이나 위법성을 판정하지 않습니다. 게시된 글은 작성자의 경험과 주장이며, <b>공감은 사실 인정이나
        법적 동의를 뜻하지 않습니다.</b> 공식 민원·신고는 해당 기관에 직접 진행해야 합니다
        (<Link href="/remedy">권리구제 안내</Link> · <Link href="/report">제보 안내</Link>).
      </Card>

      <CategoryTabs
        active={category ?? ''}
        tabs={[
          { key: '', label: '전체', href: buildHref({ ...f, category: undefined, page: 1 }) },
          ...CASE_CATEGORIES.map(([v, l]) => ({ key: v, label: l, href: buildHref({ ...f, category: v, page: 1 }) })),
        ]}
      />

      <Card className="flat">
        <div className="btn-row" style={{ marginBottom: 10, alignItems: 'center' }}>
          <form action="/cases" method="get" className="hsearch" style={{ marginLeft: 0 }}>
            {category && <input type="hidden" name="category" value={category} />}
            {sort !== 'new' && <input type="hidden" name="sort" value={sort} />}
            <Search size={16} />
            <input type="text" name="q" defaultValue={q} placeholder="사건 제목·내용 검색" aria-label="사건 검색" />
          </form>
          <div className="btn-row board-filter-group">
            <div className="seg">
              <Link href={buildHref({ ...f, sort: 'new', page: 1 })} className={sort === 'new' ? 'active' : ''}>최신순</Link>
              <Link href={buildHref({ ...f, sort: 'empathy', page: 1 })} className={sort === 'empathy' ? 'active' : ''}>공감순</Link>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        {data.items.length ? (
          <>
            <div className="post-list-head sub">전체 {data.total}건</div>
            <div className="post-list">
              {data.items.map((c) => (
                <Link href={`/cases/${c.id}`} key={c.id} className="post-row">
                  <div className="post-row-top">
                    <span className="badge cat-case">{c.category_label}</span>
                    {c.station_name && <span className="sub">{c.station_name}</span>}
                  </div>
                  <div className="post-row-title">{c.title}</div>
                  <p className="sub" style={{ margin: '0 0 8px', fontSize: 13.5 }}>{c.excerpt}</p>
                  <div className="post-row-meta">
                    <span className="sub">{formatDate(c.created_at)}</span>
                    <span className="stat"><Heart size={12} />공감 {c.empathy_count}</span>
                    <span className="stat"><Eye size={12} />{c.view_count}</span>
                    {c.update_count > 0 && <span className="stat"><History size={12} />진행 기록 {c.update_count}</span>}
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <p className="sub">
            {failed ? '목록을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.'
              : q ? '검색 결과가 없습니다.'
              : <>아직 기록된 사건이 없습니다. <Link href="/cases/new">첫 사건 기록하기</Link></>}
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

      <Link href="/cases/new" className="fab-write" aria-label="사건 기록하기">
        <PenLine size={22} /><span>기록하기</span>
      </Link>
    </>
  );
}
