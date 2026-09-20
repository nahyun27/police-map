import type { Metadata } from 'next';
import Link from 'next/link';
import { Building2, UserRound } from 'lucide-react';
import { Card, PageHead, Score } from '@/components/ui';
import { OFFICERS, STATIONS, avgRating, findStation } from '@/data/sample';
import { NOINDEX } from '@/lib/seo';

type Props = { searchParams: Promise<{ q?: string | string[] }> };

// 검색 결과 페이지는 색인하지 않는다.
export const metadata: Metadata = { title: '검색', robots: NOINDEX };

export default async function SearchPage({ searchParams }: Props) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? '').trim();
  const stations = q ? STATIONS.filter((s) => s.name.includes(q)) : [];
  const officers = q ? OFFICERS.filter((o) => o.name.includes(q) || o.dept.includes(q)) : [];

  return (
    <>
      <PageHead eyebrow="검색" title={q ? `"${q}" 검색 결과` : '검색어를 입력해 주세요'} sub={q ? `경찰서 ${stations.length}건 · 수사관 ${officers.length}건` : undefined} />
      <div className="grid2">
        <Card>
          <h2><Building2 size={17} style={{ verticalAlign: -2, marginRight: 8, color: 'var(--brand)' }} />경찰서 ({stations.length})</h2>
          {stations.length ? stations.map((s) => (
            <div className="review" key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div><Link href={`/station/${s.id}`} style={{ fontWeight: 650 }}>{s.name}</Link><div className="sub">평가 {s.reviews}건</div></div>
              <Score value={s.rating} />
            </div>
          )) : <p className="sub">결과 없음</p>}
        </Card>
        <Card>
          <h2><UserRound size={17} style={{ verticalAlign: -2, marginRight: 8, color: 'var(--brand)' }} />수사관 ({officers.length})</h2>
          {officers.length ? officers.map((o) => (
            <div className="review" key={o.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div>
                <Link href={`/officer/${o.id}`} style={{ fontWeight: 650 }}>{o.name} {o.rank}</Link>
                <div className="sub">{findStation(o.station)?.name} · {o.dept}</div>
              </div>
              <Score value={avgRating(o.rating)} />
            </div>
          )) : <p className="sub">결과 없음</p>}
        </Card>
      </div>
    </>
  );
}
