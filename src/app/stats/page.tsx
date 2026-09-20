import type { Metadata } from 'next';
import Link from 'next/link';
import ClickableRow from '@/components/ClickableRow';
import { Bars, Card, PageHead, Score, TableWrap } from '@/components/ui';
import { STATIONS } from '@/data/sample';

export const metadata: Metadata = {
  title: '전국 통계',
  description: '이용자 평가 통계와 정보공개청구로 확보한 수사관 기피신청·수용률 공개통계.',
};

const APPEALS: [string, number][] = [
  ['2018', 2425], ['2019', 2900], ['2020', 3300], ['2021', 3800], ['2022', 4400], ['2023', 4833],
];

export default function StatsPage() {
  const max = APPEALS[APPEALS.length - 1][1];
  const ranked = [...STATIONS].sort((a, b) => b.rating - a.rating);

  return (
    <>
      <PageHead
        eyebrow="통계"
        title="전국 통계 대시보드"
        sub="이용자 평가 통계와 정보공개청구로 확보한 공식 통계를 함께 제공합니다. 아래 수치는 전부 샘플입니다."
      />

      <div className="grid3">
        <Card className="kpi"><div className="num">3.5</div><div className="lbl">전국 평균 평가(5점 만점)</div></Card>
        <Card className="kpi"><div className="num">4,833</div><div className="lbl">연간 수사관 기피신청 (2023, 공개통계)</div></Card>
        <Card className="kpi"><div className="num">약 65%</div><div className="lbl">기피신청 수용률 (공개통계 기준)</div></Card>
      </div>

      <div className="grid2">
        <Card>
          <h2>항목별 전국 평균(샘플)</h2>
          <Bars rating={{ fair: 3.6, proc: 3.8, att: 3.3, comm: 3.1, speed: 3.4 }} />
          <p className="sub" style={{ marginTop: 14 }}>
            소통·응대 항목이 전국적으로 가장 낮게 평가되는 경향 — "진행상황 통지 부족"이 최다 언급 키워드(샘플 분석).
          </p>
        </Card>
        <Card>
          <h2>수사관 기피신청 추이(공개통계)</h2>
          {APPEALS.map(([y, v]) => (
            <div className="barrow" key={y}>
              <div className="lb" style={{ width: 44 }}>{y}</div>
              <div className="bar"><i style={{ width: `${(v / max) * 100}%` }} /></div>
              <div className="vl" style={{ width: 52 }}>{v.toLocaleString()}</div>
            </div>
          ))}
          <p className="sub" style={{ marginTop: 14 }}>출처: 언론 보도 기반 샘플(실서비스에서는 정보공개청구 원자료 게재)</p>
        </Card>
      </div>

      <Card>
        <h2>관서별 평가 순위(샘플)</h2>
        <TableWrap>
          <table className="list">
            <thead><tr><th style={{ width: 56 }}>순위</th><th>경찰서</th><th>평균</th><th>평가 수</th></tr></thead>
            <tbody>
              {ranked.map((s, i) => (
                <ClickableRow key={s.id} href={`/station/${s.id}`}>
                  <td style={{ fontWeight: 700, color: i < 3 ? 'var(--brand)' : 'var(--muted)' }}>{i + 1}</td>
                  <td><Link href={`/station/${s.id}`}>{s.name}</Link></td>
                  <td><Score value={s.rating} /></td>
                  <td>{s.reviews}건</td>
                </ClickableRow>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </>
  );
}
