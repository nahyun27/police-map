import type { Metadata } from 'next';
import Link from 'next/link';
import { PoliceStationIcon } from '@/components/icons/PoliceStationIcon';
import { Card, PageHead, Score } from '@/components/ui';
import { search as apiSearch } from '@/lib/api';
import { NOINDEX } from '@/lib/seo';

// 백엔드의 실시간 데이터를 그리므로 빌드 시점에 정적 생성하지 않는다.
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ q?: string | string[] }> };

// 검색 결과 페이지는 색인하지 않는다.
export const metadata: Metadata = { title: '검색', robots: NOINDEX };

export default async function SearchPage({ searchParams }: Props) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? '').trim();
  let failed = false;
  const result = q ? await apiSearch(q).catch(() => { failed = true; return null; }) : null;
  const stations = result?.stations ?? [];

  return (
    <>
      <PageHead
        eyebrow="검색"
        title={q ? `"${q}" 검색 결과` : '검색어를 입력해 주세요'}
        sub={q ? `경찰서 ${stations.length}건` : undefined}
      />
      <Card>
        <h2><PoliceStationIcon size={17} style={{ verticalAlign: -2, marginRight: 8, color: 'var(--brand)' }} />경찰서 ({stations.length})</h2>
        {failed ? <p className="sub">검색 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.</p> : stations.length ? stations.map((s) => (
          <div className="review" key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <Link href={`/station/${s.id}`} style={{ fontWeight: 650 }}>{s.name}</Link>
              <div className="sub">{s.address ?? '주소 정보 없음'}</div>
            </div>
            <Score value={s.rating.overall} />
          </div>
        )) : <p className="sub">{q ? '결과 없음' : '경찰서 이름을 입력해 검색해 보세요.'}</p>}
      </Card>
    </>
  );
}
