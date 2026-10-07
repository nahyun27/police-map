import type { Metadata } from 'next';
import Link from 'next/link';
import ClickableRow from '@/components/ClickableRow';
import { Bars, Card, PageHead, Score } from '@/components/ui';
import { getStats, type StatsOverview } from '@/lib/api';

// 백엔드의 실시간 데이터를 그리므로 빌드 시점에 정적 생성하지 않는다.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '전국 통계',
  description: '이용자 평가 통계와 정보공개청구로 확보한 수사관 기피신청·수용률 공개통계.',
};

export default async function StatsPage() {
  let stats: StatsOverview;
  try {
    stats = await getStats();
  } catch {
    return (
      <>
        <PageHead eyebrow="통계" title="전국 통계 대시보드" sub="이용자 평가 통계와 정보공개청구로 확보한 공식 통계를 함께 제공합니다." />
        <Card><p className="sub">통계를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.</p></Card>
      </>
    );
  }
  const appeals = stats.appeals_filed;
  const max = appeals.length ? Math.max(...appeals.map((a) => a.value)) : 1;
  const latestAppeal = appeals.at(-1);

  return (
    <>
      <PageHead
        eyebrow="통계"
        title="전국 통계 대시보드"
        sub="이용자 평가 통계와 정보공개청구로 확보한 공식 통계를 함께 제공합니다."
      />

      <div className="grid3">
        <Card className="kpi">
          <div className="num">{stats.national.overall !== null ? stats.national.overall.toFixed(1) : '–'}</div>
          <div className="lbl">전국 평균 평가(5점 만점, {stats.totals.reviews.toLocaleString()}건)</div>
        </Card>
        <Card className="kpi">
          <div className="num">{latestAppeal ? latestAppeal.value.toLocaleString() : '–'}</div>
          <div className="lbl">연간 수사관 기피신청{latestAppeal ? `(${latestAppeal.year}, 공개통계)` : ''}</div>
        </Card>
        <Card className="kpi">
          <div className="num">{stats.appeal_acceptance_rate ? `약 ${stats.appeal_acceptance_rate.value}%` : '–'}</div>
          <div className="lbl">기피신청 수용률(공개통계 기준)</div>
        </Card>
      </div>

      <div className="grid2">
        <Card>
          <h2>항목별 전국 평균</h2>
          {stats.national.count ? (
            <Bars rating={stats.national} />
          ) : (
            <p className="sub">아직 게시된 평가가 없습니다.</p>
          )}
        </Card>
        <Card>
          <h2>수사관 기피신청 추이(공개통계)</h2>
          {appeals.length ? appeals.map((a) => (
            <div className="barrow" key={a.year}>
              <div className="lb" style={{ width: 44 }}>{a.year}</div>
              <div className="bar"><i style={{ width: `${(a.value / max) * 100}%` }} /></div>
              <div className="vl" style={{ width: 52 }}>{a.value.toLocaleString()}</div>
            </div>
          )) : <p className="sub">등록된 공개통계가 없습니다.</p>}
          <p className="sub" style={{ marginTop: 14 }}>실서비스에서는 정보공개청구 원자료를 게재합니다.</p>
        </Card>
      </div>

      <Card>
        <h2>관서별 평가 순위</h2>
        <div className="table-wrap">
          <table className="list">
            <thead><tr><th style={{ width: 56 }}>순위</th><th>경찰서</th><th>평균</th><th>평가 수</th></tr></thead>
            <tbody>
              {stats.station_ranking.length ? (
                stats.station_ranking.map((s, i) => (
                  <ClickableRow key={s.id} href={`/station/${s.id}`}>
                    <td style={{ fontWeight: 700, color: i < 3 ? 'var(--brand)' : 'var(--muted)' }}>{i + 1}</td>
                    <td><Link href={`/station/${s.id}`}>{s.name}</Link></td>
                    <td><Score value={s.rating} /></td>
                    <td>{s.review_count}건</td>
                  </ClickableRow>
                ))
              ) : (
                <tr><td colSpan={4} className="sub">아직 평가가 집계된 경찰서가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
