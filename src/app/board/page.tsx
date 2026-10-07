import type { Metadata } from 'next';
import Link from 'next/link';
import { Card, Crumb, PageHead, TableWrap } from '@/components/ui';
import { getRegions, listPosts } from '@/lib/api';
import { formatDate } from '@/lib/format';

type Props = { searchParams: Promise<{ region?: string; sort?: string; page?: string }> };

const PAGE_SIZE = 20;

export const metadata: Metadata = { title: '커뮤니티 게시판' };

function buildHref(base: { region?: string; sort: string; page?: number }) {
  const p = new URLSearchParams();
  if (base.region) p.set('region', base.region);
  if (base.sort !== 'new') p.set('sort', base.sort);
  if (base.page && base.page > 1) p.set('page', String(base.page));
  const s = p.toString();
  return `/board${s ? `?${s}` : ''}`;
}

export default async function BoardPage({ searchParams }: Props) {
  const sp = await searchParams;
  const region = sp.region || undefined;
  const sort = sp.sort === 'top' ? 'top' : 'new';
  const page = Math.max(1, Number(sp.page ?? '1') || 1);

  const [regions, posts] = await Promise.all([getRegions(), listPosts({ regionId: region, sort, page, size: PAGE_SIZE })]);
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
          <Link href={buildHref({ sort, page: 1 })} className={`btn sm ${!region ? '' : 'line'}`}>전체</Link>
          {regions.map((r) => (
            <Link key={r.id} href={buildHref({ region: r.id, sort, page: 1 })} className={`btn sm ${region === r.id ? '' : 'line'}`}>
              {r.name}
            </Link>
          ))}
        </div>
        <div className="btn-row">
          <Link href={buildHref({ region, sort: 'new', page: 1 })} className={`btn sm ${sort === 'new' ? '' : 'line'}`}>최신순</Link>
          <Link href={buildHref({ region, sort: 'top', page: 1 })} className={`btn sm ${sort === 'top' ? '' : 'line'}`}>인기순</Link>
        </div>
      </Card>

      <Card>
        <TableWrap>
          <table className="list">
            <thead><tr><th>지역</th><th>제목</th><th>작성자</th><th>추천</th><th>댓글</th><th>작성일</th></tr></thead>
            <tbody>
              {posts.items.length ? posts.items.map((p) => (
                <tr key={p.id}>
                  <td className="sub">{p.region_name}{p.station_name ? ` · ${p.station_name}` : ''}</td>
                  <td><Link href={`/board/${p.id}`}>{p.title}</Link></td>
                  <td className="sub">{p.author_nickname}</td>
                  <td className="sub">{p.score}</td>
                  <td className="sub">{p.comment_count}</td>
                  <td className="sub">{formatDate(p.created_at)}</td>
                </tr>
              )) : (
                <tr><td colSpan={6} className="sub">등록된 글이 없습니다. 첫 글을 남겨 보세요.</td></tr>
              )}
            </tbody>
          </table>
        </TableWrap>
        {totalPages > 1 && (
          <div className="btn-row" style={{ marginTop: 16, alignItems: 'center' }}>
            {page > 1 && <Link href={buildHref({ region, sort, page: page - 1 })} className="btn line sm">이전</Link>}
            <span className="sub">{page} / {totalPages}</span>
            {page < totalPages && <Link href={buildHref({ region, sort, page: page + 1 })} className="btn line sm">다음</Link>}
          </div>
        )}
      </Card>
    </>
  );
}
