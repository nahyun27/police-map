import type { Metadata } from 'next';
import Link from 'next/link';
import { Search } from 'lucide-react';
import { PoliceStationIcon } from '@/components/icons/PoliceStationIcon';
import { Card, PageHead, Score } from '@/components/ui';
import { search as apiSearch } from '@/lib/api';
import { NOINDEX } from '@/lib/seo';

// 백엔드의 실시간 데이터를 그리므로 빌드 시점에 정적 생성하지 않는다.
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ q?: string | string[]; intent?: string | string[] }> };

// 검색 결과 페이지는 색인하지 않는다.
export const metadata: Metadata = { title: '검색', robots: NOINDEX };

export default async function SearchPage({ searchParams }: Props) {
  const sp = await searchParams;
  const raw = sp.q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? '').trim();
  // intent=write 로 들어오면(홈 "평가 바로 작성하기" 카드) 검색 결과에서 상세보기 대신
  // 평가 작성 페이지로 바로 연결한다 — 경찰서를 고르는 즉시 평가를 쓰게 하기 위함.
  const intentRaw = sp.intent;
  const forWrite = (Array.isArray(intentRaw) ? intentRaw[0] : intentRaw) === 'write';
  let failed = false;
  const result = q ? await apiSearch(q).catch(() => { failed = true; return null; }) : null;
  const stations = result?.stations ?? [];

  return (
    <>
      <PageHead
        eyebrow={forWrite ? '평가 작성' : '검색'}
        title={q ? `"${q}" 검색 결과` : forWrite ? '평가할 경찰서를 선택해 주세요' : '검색어를 입력해 주세요'}
        sub={q ? `경찰서 ${stations.length}건` : forWrite ? '이름으로 검색한 뒤, 바로 평가를 작성할 수 있습니다.' : undefined}
      />
      <Card>
        {/* 이 페이지에 바로 들어왔을 때(홈 카드 등) 입력창이 없어 막다른 화면처럼 보이던 문제를
            고치기 위한 검색창. GET 폼이라 자바스크립트 없이도 동작한다. */}
        <form action="/search" style={{ display: 'flex', gap: 10, marginBottom: stations.length || failed ? 24 : 0 }}>
          {forWrite && <input type="hidden" name="intent" value="write" />}
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
            <input
              type="text" name="q" defaultValue={q} placeholder="경찰서 이름으로 검색"
              style={{ width: '100%', border: '1px solid var(--line)', background: '#fff', borderRadius: 12, padding: '12px 14px 12px 40px', fontSize: 15, color: 'var(--ink)' }}
            />
          </div>
          <button type="submit" className="btn">검색</button>
        </form>
        {(q || failed) && (
          <>
            <h2><PoliceStationIcon size={17} style={{ verticalAlign: -2, marginRight: 8, color: 'var(--brand)' }} />경찰서 ({stations.length})</h2>
            {failed ? <p className="sub">검색 중 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.</p> : stations.length ? stations.map((s) => (
              <div className="review" key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <Link href={`/station/${s.id}`} style={{ fontWeight: 650 }}>{s.name}</Link>
                  <div className="sub">{s.address ?? '주소 정보 없음'}</div>
                </div>
                {forWrite ? (
                  <Link href={`/station/${s.id}/write`} className="btn sm">평가 작성</Link>
                ) : (
                  <Score value={s.rating.overall} />
                )}
              </div>
            )) : <p className="sub">결과 없음</p>}
          </>
        )}
      </Card>
    </>
  );
}
