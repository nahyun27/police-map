import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ClickableRow from '@/components/ClickableRow';
import { Bars, Card, Crumb, Score, Stars, TableWrap } from '@/components/ui';
import { OFFICERS, STATIONS, avgRating, findRegion, findStation } from '@/data/sample';

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return STATIONS.map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const s = findStation((await params).id);
  if (!s) return {};
  return {
    title: `${s.name} 수사 평가`,
    description: `${s.name}의 수사 절차 평가(평균 ${s.rating}점, ${s.reviews}건)와 수사부서 정보.`,
  };
}

export default async function StationPage({ params }: Props) {
  const s = findStation((await params).id);
  if (!s) notFound();
  const rg = findRegion(s.region)!;
  const officers = OFFICERS.filter((o) => o.station === s.id);

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: rg.full, to: `/region/${rg.id}` }, { label: s.name }]} />
      <Card>
        <div className="flex">
          <div className="grow">
            <div className="eyebrow">경찰서</div>
            <h1>{s.name}</h1>
            <p className="sub" style={{ marginTop: 8 }}>수사부서 · {s.depts.join(' · ')}</p>
          </div>
          <div className="bigscore">
            <div className="num">{s.rating}</div>
            <div className="lbl"><Stars value={s.rating} /> · 평가 {s.reviews}건</div>
          </div>
        </div>
      </Card>

      <div className="grid2">
        <Card>
          <h2>관서 평가 요약(샘플)</h2>
          <Bars rating={{ fair: s.rating, proc: s.rating + 0.2, att: s.rating - 0.3, comm: s.rating - 0.4, speed: s.rating - 0.1 }} />
          <p className="sub" style={{ marginTop: 14 }}>항목: 공정성 / 절차 준수 / 조사 태도 / 소통·응대 / 신속성 (각 5점)</p>
        </Card>
        <Card className="tint">
          <h2>수사관 정보 게재 기준</h2>
          <p style={{ color: 'var(--ink2)' }}>
            공개자료(인사발령 공고·관서 홈페이지·언론보도) 및 사건서류로 검증된 이용자 제보에 한해 게재하며,
            직무 관련 정보(성명·계급·소속)로 한정합니다.
          </p>
        </Card>
      </div>

      <Card>
        <h2>소속 수사관</h2>
        <TableWrap>
          <table className="list">
            <thead>
              <tr><th>수사관</th><th>소속 부서</th><th>평균 평가</th><th>평가 수</th></tr>
            </thead>
            <tbody>
              {officers.length ? (
                officers.map((o) => (
                  <ClickableRow key={o.id} href={`/officer/${o.id}`}>
                    <td><Link href={`/officer/${o.id}`}>{o.name} {o.rank}</Link><span className="tag">{o.src}</span></td>
                    <td>{o.dept}</td>
                    <td><Score value={avgRating(o.rating)} /></td>
                    <td>{o.n}건</td>
                  </ClickableRow>
                ))
              ) : (
                <tr><td colSpan={4} className="sub">등록된 수사관 정보가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </>
  );
}
