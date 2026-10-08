import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Bars, Card, Crumb, Stars } from '@/components/ui';
import { ReviewList } from '@/components/ReviewList';
import { ShieldCheck } from 'lucide-react';
import { ApiError, getStation } from '@/lib/api';
import stationJurisdiction from '@/data/stationJurisdiction.json';

type JurisdictionEntry = {
  text: string;
  kind: 'whole' | 'dong_list' | 'complex';
  path?: string;
  viewBox?: string;
  labelX?: number;
  labelY?: number;
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; evidence?: string }> };

const PAGE_SIZE = 10;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const s = await getStation((await params).id);
    const ratingNote = s.rating.count ? `(평균 ${s.rating.overall?.toFixed(1)}점, ${s.rating.count}건)` : '';
    return { title: `${s.name} 수사 평가`, description: `${s.name}의 수사 절차 평가${ratingNote}와 수사부서 정보.` };
  } catch {
    return {};
  }
}

export default async function StationPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const evidenceOnly = sp.evidence === '1';
  let s;
  try {
    s = await getStation(id, { page, size: PAGE_SIZE, evidenceOnly });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const totalPages = Math.max(1, Math.ceil(s.reviews.total / s.reviews.size));
  const pageHref = (p: number) => `/station/${s.id}?page=${p}${evidenceOnly ? '&evidence=1' : ''}`;
  // 이름+지역을 키로 쓴다(숫자 id 는 로컬 개발 DB와 운영 DB에서 같은 관서라도 다르게
  // 배정돼 있어서 환경마다 어긋난다 — scripts/build_station_jurisdiction.py 주석 참고).
  const jurisdiction = (stationJurisdiction as Record<string, JurisdictionEntry>)[`${s.name}:${s.region.id}`];

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: s.region.full_name, to: `/region/${s.region.id}` }, { label: s.name }]} />
      <Card>
        <div className="flex">
          <div className="grow">
            <div className="eyebrow">경찰서</div>
            <h1>{s.name}</h1>
            <p className="sub" style={{ marginTop: 8 }}>
              {s.address ?? '주소 정보 없음'}
              {s.website && <> · <a href={s.website} target="_blank" rel="noopener noreferrer">공식 홈페이지 ↗</a></>}
            </p>
          </div>
          <div className="bigscore">
            <div className="num">{s.rating.overall !== null ? s.rating.overall.toFixed(1) : '–'}</div>
            <div className="lbl"><Stars value={s.rating.overall} /> · 평가 {s.rating.count}건</div>
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 24 }}>
          <Link href={`/station/${s.id}/write`} className="btn">이 경찰서 평가 작성</Link>
          <Link href={`/remedy/${s.id}`} className="btn line">민원·권리구제 안내</Link>
          <Link href={`/report/${s.id}`} className="btn line">언론·기관 제보</Link>
        </div>
      </Card>

      <div className="grid2">
        <Card>
          <h2>평가 요약</h2>
          {s.rating.count ? (
            <>
              <Bars rating={s.rating} />
              <p className="sub" style={{ marginTop: 14 }}>항목: 공정성 / 절차 준수 / 조사 태도 / 소통·응대 / 신속성 (각 5점)</p>
              {s.by_case_type.length > 1 && (
                <div style={{ marginTop: 18, borderTop: '1px solid var(--line)', paddingTop: 14 }}>
                  <p className="sub" style={{ fontWeight: 700, marginBottom: 8 }}>사건유형별 평균</p>
                  {s.by_case_type.map((c) => (
                    <div key={c.case_type} className="barrow">
                      <div className="lb" style={{ width: 76 }}>{c.case_type_label}</div>
                      <div className="bar"><i style={{ width: `${((c.rating.overall ?? 0) / 5) * 100}%` }} /></div>
                      <div className="vl" style={{ width: 70 }}>{c.rating.overall?.toFixed(1)} ({c.rating.count}건)</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="sub">아직 등록된 평가가 없습니다. 이 경찰서의 첫 평가를 남겨 주세요.</p>
          )}
        </Card>
        <Card className="tint">
          <h2>공개 정보 출처</h2>
          <p style={{ color: 'var(--ink2)' }}>{s.source ?? '경찰청 전국경찰관서안내 공개자료'}</p>
        </Card>
      </div>

      {s.nearby.length > 0 && (
        <Card>
          <h2>인근 경찰서</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {s.nearby.map((n) => (
              <Link key={n.id} href={`/station/${n.id}`} className="card clickable-card flat" style={{ flex: '1 1 180px', margin: 0, padding: 14 }}>
                <p style={{ fontWeight: 700 }}>{n.name}</p>
                <p className="sub" style={{ marginTop: 4 }}>
                  {n.distance_km}km · {n.rating.overall !== null ? `평균 ${n.rating.overall.toFixed(1)}점` : '평가 없음'}
                </p>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <h2>수사부서 <span className="tag">홈페이지 공개 기준</span></h2>
        {s.departments.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {s.departments.map((d) => <span key={d} className="badge">{d}</span>)}
          </div>
        ) : (
          <p className="sub">공개된 부서 정보가 없습니다.</p>
        )}
      </Card>

      {jurisdiction && (
        <Card>
          <h2>관할구역 <span className="tag">경찰청과 그 소속기관 직제 시행규칙 별표2</span></h2>
          {jurisdiction.kind !== 'complex' && jurisdiction.path ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <svg
                  viewBox={jurisdiction.viewBox} style={{ width: '100%', maxWidth: 280, height: 'auto' }}
                  role="img" aria-label={`${s.name} 관할구역 지도`}
                >
                  <path d={jurisdiction.path} fill="var(--brand-soft)" stroke="var(--brand)" strokeWidth={1.5} />
                  {jurisdiction.labelX !== undefined && jurisdiction.labelY !== undefined && (
                    <text
                      x={jurisdiction.labelX} y={jurisdiction.labelY} textAnchor="middle"
                      fontSize={15} fontWeight={700} fill="var(--brand-ink)"
                    >
                      {s.name.replace(/경찰서$/, '')}
                    </text>
                  )}
                </svg>
              </div>
              <p className="sub" style={{ textAlign: 'center', marginTop: 8 }}>{jurisdiction.text}</p>
            </>
          ) : (
            <p className="sub">{jurisdiction.text}</p>
          )}
        </Card>
      )}

      <Card>
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <h2 style={{ marginBottom: 0 }}>평가 후기 <span className="sub" style={{ fontWeight: 500 }}>{s.reviews.total}건</span></h2>
          <Link href={`/station/${s.id}${evidenceOnly ? '' : '?evidence=1'}`} className={`link-btn ${evidenceOnly ? 'on' : ''}`}>
            <ShieldCheck size={13} />증빙확인된 평가만 보기
          </Link>
        </div>
        {s.reviews.items.length ? (
          <ReviewList stationId={s.id} stationName={s.name} items={s.reviews.items} />
        ) : (
          <p className="sub">{evidenceOnly ? '증빙확인된 평가가 아직 없습니다.' : '등록된 평가가 없습니다.'}</p>
        )}
        {totalPages > 1 && (
          <div className="btn-row" style={{ marginTop: 16, alignItems: 'center' }}>
            {page > 1 && <Link href={pageHref(page - 1)} className="btn line sm">이전</Link>}
            <span className="sub">{page} / {totalPages}</span>
            {page < totalPages && <Link href={pageHref(page + 1)} className="btn line sm">다음</Link>}
          </div>
        )}
      </Card>
    </>
  );
}
