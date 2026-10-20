import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Bars, Card, Crumb, Score, Stars } from '@/components/ui';
import { ReviewList } from '@/components/ReviewList';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { ApiError, getStation } from '@/lib/api';
import stationJurisdiction from '@/data/stationJurisdiction.json';
import { AdSlots } from '@/components/AdSlots';
import { JsonLd } from '@/components/JsonLd';
import { pageMeta, SITE_URL } from '@/lib/seo';

type JurisdictionEntry = {
  text: string;
  kind: 'whole' | 'dong_list' | 'complex';
  path?: string;
  viewBox?: string;
  labelX?: number;
  labelY?: number;
  stationX?: number;
  stationY?: number;
};

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string; evidence?: string; dept?: string; officer?: string }> };

const PAGE_SIZE = 10;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) return {};
    const s = await getStation(id);
    const ratingNote = s.rating.count ? ` 평균 ${s.rating.overall?.toFixed(1)}점(${s.rating.count}건).` : '';
    // "OO경찰서 후기", "OO경찰서 수사과" 같은 검색어에 걸리도록 이름·주소·부서명을 설명에 넣는다.
    const depts = s.departments.slice(0, 4).join('·');
    const title = `${s.name} 수사 평가·후기`;
    const description =
      `${s.name}${s.address ? `(${s.address})` : ''} 수사 절차에 대한 이용자 평가와 후기.${ratingNote}` +
      `${depts ? ` 수사부서(${depts} 등) 정보와` : ''} 민원·권리구제 방법 안내.`;
    return pageMeta({ title, description, path: `/station/${id}` });
  } catch {
    return {};
  }
}

export default async function StationPage({ params, searchParams }: Props) {
  const id = Number((await params).id);
  // /station/abc 처럼 숫자가 아닌 주소는 백엔드가 422 를 줘서 에러 페이지가 떴다. 없는 페이지로 처리한다.
  if (!Number.isInteger(id) || id <= 0) notFound();
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? '1') || 1);
  const evidenceOnly = sp.evidence === '1';
  // 부서·수사관별 평가만 보기(2026-10 의뢰인 결정: 경찰서·부서·개인 단위 평가)
  const deptFilter = Number(sp.dept) || undefined;
  const officerFilter = Number(sp.officer) || undefined;
  let s;
  try {
    s = await getStation(id, { page, size: PAGE_SIZE, evidenceOnly, departmentId: deptFilter, officerId: officerFilter });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 422)) notFound();
    throw e;
  }
  const totalPages = Math.max(1, Math.ceil(s.reviews.total / s.reviews.size));
  const filterQs = `${deptFilter ? `&dept=${deptFilter}` : ''}${officerFilter ? `&officer=${officerFilter}` : ''}`;
  const pageHref = (p: number) => `/station/${s.id}?page=${p}${evidenceOnly ? '&evidence=1' : ''}${filterQs}`;
  const deptRatings = s.department_ratings ?? [];
  const officerRatings = s.officer_ratings ?? [];
  // 이름+지역을 키로 쓴다(숫자 id 는 로컬 개발 DB와 운영 DB에서 같은 관서라도 다르게
  // 배정돼 있어서 환경마다 어긋난다 — scripts/build_station_jurisdiction.py 주석 참고).
  const jurisdiction = (stationJurisdiction as Record<string, JurisdictionEntry>)[`${s.name}:${s.region.id}`];

  // 검색엔진용 경찰서 정보. 평가가 있을 때만 별점을 넣는다(0건 별점은 구글 지침 위반이라 아예 뺀다).
  const stationLd = {
    '@context': 'https://schema.org',
    '@type': 'PoliceStation',
    name: s.name,
    url: `${SITE_URL}/station/${s.id}`,
    ...(s.address ? { address: { '@type': 'PostalAddress', streetAddress: s.address, addressCountry: 'KR' } } : {}),
    ...(s.lat !== null && s.lng !== null ? { geo: { '@type': 'GeoCoordinates', latitude: s.lat, longitude: s.lng } } : {}),
    ...(s.website ? { sameAs: [s.website] } : {}),
    ...(s.rating.count && s.rating.overall !== null
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: s.rating.overall.toFixed(1), ratingCount: s.rating.count, bestRating: 5, worstRating: 1 } }
      : {}),
  };

  return (
    <>
      <JsonLd data={stationLd} />
      <Crumb items={[{ label: '홈', to: '/' }, { label: s.region.full_name, to: `/region/${s.region.id}` }, { label: s.name }]} />
      <Card>
        <div className="flex">
          <div className="grow">
            <div className="eyebrow">경찰서</div>
            <h1>{s.name}</h1>
            <p className="sub" style={{ marginTop: 8 }}>{s.address ?? '주소 정보 없음'}</p>
          </div>
          {s.rating.count ? (
            <div className="bigscore">
              <div className="num">{s.rating.overall !== null ? s.rating.overall.toFixed(1) : '–'}</div>
              <div className="lbl"><Stars value={s.rating.overall} /> · 평가 {s.rating.count}건</div>
            </div>
          ) : (
            // 평가가 없을 때 큰 점수 자리에 "–" 하나만 덩그러니 뜨던 것 대신 작은 안내 문구로.
            <div className="bigscore bigscore-empty">
              <div className="lbl">아직 평가 없음</div>
            </div>
          )}
        </div>
        <div className="btn-row" style={{ marginTop: 24 }}>
          <Link href={`/station/${s.id}/write`} className="btn">이 경찰서 평가 작성</Link>
          <Link href={`/remedy/${s.id}`} className="btn line">민원·권리구제 안내</Link>
          <Link href={`/report/${s.id}`} className="btn line">언론·기관 제보</Link>
          {s.website && (
            <a href={s.website} target="_blank" rel="noopener noreferrer" className="btn line">
              경찰서 홈페이지<ExternalLink size={14} />
            </a>
          )}
        </div>
      </Card>

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
            {(s.department_items ?? s.departments.map((name, i) => ({ id: -i, label: name }))).map((d) => (
              d.id > 0 ? (
                // 누르면 그 부서 대상 평가만 모아 본다(부서별 평가, 2026-10).
                <Link key={d.id} href={`/station/${s.id}?dept=${d.id}#reviews`} className={`badge dept-badge${deptFilter === d.id ? ' on' : ''}`}>{d.label}</Link>
              ) : <span key={d.id} className="badge">{d.label}</span>
            ))}
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
                  {jurisdiction.stationX !== undefined && jurisdiction.stationY !== undefined ? (
                    // 실제 경찰서 주소 위치 — 관할구역 도형의 기하학적 중심(labelX/Y)과는
                    // 다른 지점이라, 라벨도 도형 중심이 아니라 이 실제 위치 옆에 붙인다.
                    <g transform={`translate(${jurisdiction.stationX} ${jurisdiction.stationY})`}>
                      <path
                        d="M0,-9.3L7,-9.3L10,-4L10,1.1L0,11.5L-10,1.1L-10,-4L-7,-9.3Z"
                        fill="var(--brand)" stroke="#fff" strokeWidth={1}
                      />
                      <text y={24} textAnchor="middle" fontSize={14} fontWeight={700} fill="var(--brand-ink)">
                        {s.name.replace(/경찰서$/, '')}
                      </text>
                    </g>
                  ) : jurisdiction.labelX !== undefined && jurisdiction.labelY !== undefined && (
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

      {(deptRatings.length > 0 || officerRatings.length > 0) && (
        <Card id="target-ratings">
          <h2>부서·수사관별 평가</h2>
          <p className="sub" style={{ marginBottom: 12 }}>
            누르면 해당 평가만 모아 볼 수 있어요. 수사관 이름은 일부 가려서 표시하며, 이용자가 입력한 미검증 정보입니다.
          </p>
          <div className="grid2" style={{ marginBottom: 0 }}>
            {deptRatings.length > 0 && (
              <div>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>부서</h3>
                {deptRatings.map((t) => (
                  <Link key={`d${t.id}`} href={`/station/${s.id}?dept=${t.id}#reviews`} className="target-row">
                    <span>{t.label}</span>
                    <span className="sub"><Score value={t.rating.overall} /> · {t.rating.count}건</span>
                  </Link>
                ))}
              </div>
            )}
            {officerRatings.length > 0 && (
              <div>
                <h3 style={{ fontSize: 15, marginBottom: 8 }}>수사관</h3>
                {officerRatings.map((t) => (
                  <div key={`o${t.id}`} className="target-row">
                    <Link href={`/station/${s.id}?officer=${t.id}#reviews`}>
                      {t.label}{t.rank ? ` ${t.rank}` : ''}{t.department_name ? <span className="sub"> · {t.department_name}</span> : null}
                    </Link>
                    <span className="sub"><Score value={t.rating.overall} /> · {t.rating.count}건</span>
                  </div>
                ))}
                <p className="sub" style={{ fontSize: 12, marginTop: 8 }}>
                  본인 정보가 잘못 올라갔거나 게시를 원하지 않으면, 이름을 눌러 나오는 &quot;이 수사관 정보 삭제·정정 요청&quot;으로
                  요청할 수 있습니다. 접수 즉시 비공개 처리됩니다.
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      <Card id="reviews">
        {s.filter_label && (
          <div className="guidebox" style={{ marginTop: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span><b>{s.filter_label}</b> 대상 평가만 보는 중</span>
            <span className="btn-row" style={{ alignItems: 'center' }}>
              {officerFilter && <Link href={`/takedown/officer/${officerFilter}`} className="sub">이 수사관 정보 삭제·정정 요청</Link>}
              <Link href={`/station/${s.id}#reviews`} className="btn line sm">전체 보기</Link>
            </span>
          </div>
        )}
        <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          <h2 style={{ marginBottom: 0 }}>평가 후기 <span className="sub" style={{ fontWeight: 500 }}>{s.reviews.total}건</span></h2>
          <Link href={`/station/${s.id}${evidenceOnly ? '' : '?evidence=1'}`} className={`link-btn ${evidenceOnly ? 'on' : ''}`}>
            <ShieldCheck size={13} />증빙확인된 평가만 보기
          </Link>
        </div>
        {s.reviews.items.length ? (
          <ReviewList stationId={s.id} items={s.reviews.items} />
        ) : (
          <p className="sub">
            {evidenceOnly ? '증빙확인된 평가가 아직 없습니다.'
              : deptFilter ? <>이 부서에 대한 평가가 아직 없습니다. <Link href={`/station/${s.id}/write?dept=${deptFilter}`}>이 부서 평가 작성하기</Link></>
              : '등록된 평가가 없습니다.'}
          </p>
        )}
        {totalPages > 1 && (
          <div className="btn-row" style={{ marginTop: 16, alignItems: 'center' }}>
            {page > 1 && <Link href={pageHref(page - 1)} className="btn line sm">이전</Link>}
            <span className="sub">{page} / {totalPages}</span>
            {page < totalPages && <Link href={pageHref(page + 1)} className="btn line sm">다음</Link>}
          </div>
        )}
      </Card>
      <p className="sub" style={{ fontSize: 12, textAlign: 'center', marginTop: 4 }}>
        경찰서 정보 출처: {s.source ?? '경찰청 전국경찰관서안내 공개자료'}
      </p>
      <AdSlots stationId={s.id} />
    </>
  );
}
