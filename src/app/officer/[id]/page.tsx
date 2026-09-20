import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FilePenLine, Scale, UserRound } from 'lucide-react';
import DemoAlertButton from '@/components/DemoAlertButton';
import { Bars, Card, Crumb, Score, Stars } from '@/components/ui';
import { OFFICERS, REVIEWS, avgRating, findOfficer, findStation } from '@/data/sample';
import { officerRobots } from '@/lib/seo';

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return OFFICERS.map((o) => ({ id: o.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const o = findOfficer((await params).id);
  if (!o) return {};
  const s = findStation(o.station)!;
  return {
    title: `${o.name} ${o.rank} · ${s.name}`,
    description: `${s.name} ${o.dept} ${o.name} ${o.rank}에 대한 직무수행 평가.`,
    robots: officerRobots,
  };
}

export default async function OfficerPage({ params }: Props) {
  const o = findOfficer((await params).id);
  if (!o) notFound();
  const s = findStation(o.station)!;
  const reviews = REVIEWS.filter((r) => r.officer === o.id);
  const avg = avgRating(o.rating);

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: s.name, to: `/station/${s.id}` }, { label: `${o.name} ${o.rank}` }]} />
      <Card>
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <div className="ident">
            <div className="avatar"><UserRound size={30} /></div>
            <div>
              <h1>{o.name} <span>{o.rank}</span></h1>
              <p className="sub" style={{ marginTop: 4 }}>{s.name} · {o.dept}</p>
              <p className="sub" style={{ marginTop: 6 }}>
                정보 출처 · {o.src}<span className="tag">직무 관련 공개정보만 게재</span>
              </p>
            </div>
          </div>
          <div className="bigscore">
            <div className="num">{avg.toFixed(1)}</div>
            <div className="lbl"><Stars value={avg} /> · 평가 {o.n}건</div>
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 24 }}>
          <Link href={`/officer/${o.id}/write`} className="btn"><FilePenLine size={16} />이 수사관 평가 작성</Link>
          <Link href={`/remedy/${o.id}`} className="btn line"><Scale size={16} />민원·권리구제 안내</Link>
          <DemoAlertButton message={'데모: 당사자 삭제·정정 요청 절차 안내로 이동합니다.\n접수 즉시 해당 게시물은 임시조치(블라인드)됩니다.'}>
            삭제·정정 요청
          </DemoAlertButton>
        </div>
      </Card>

      <div className="grid2">
        <Card>
          <h2>항목별 평가</h2>
          <Bars rating={o.rating} />
        </Card>
        <Card>
          <h2>소속 이력 <span className="tag">공개자료 기준</span></h2>
          <ul className="history">
            {o.history.map((h, i) => <li key={i}>{h}</li>)}
          </ul>
        </Card>
      </div>

      <Card>
        <h2>평가 후기 <span className="sub" style={{ fontWeight: 500 }}>{reviews.length}건</span></h2>
        {reviews.length ? (
          reviews.map((rv, i) => (
            <div className="review" key={i}>
              <div className="meta">
                <span className="badge brand">{rv.role}</span><span className="badge">{rv.type}</span>{rv.date} · 검수 완료
              </div>
              <div className="head"><Score value={rv.stars} /></div>
              <p>{rv.text}</p>
            </div>
          ))
        ) : (
          <p className="sub">등록된 평가가 없습니다.</p>
        )}
      </Card>
    </>
  );
}
