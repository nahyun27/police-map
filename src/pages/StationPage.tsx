import { Link, useNavigate, useParams } from 'react-router-dom';
import { Bars, Card, Crumb, Stars } from '../components/ui';
import { OFFICERS, avgRating, findRegion, findStation } from '../data/sample';
import NotFound from './NotFound';

export default function StationPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const s = findStation(id);
  if (!s) return <NotFound />;
  const rg = findRegion(s.region)!;
  const officers = OFFICERS.filter((o) => o.station === s.id);

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: rg.full, to: `/region/${rg.id}` }, { label: s.name }]} />
      <Card>
        <div className="flex">
          <div className="grow">
            <h1>{s.name}</h1>
            <p className="sub">수사부서: {s.depts.join(' · ')}</p>
          </div>
          <div className="kpi">
            <div className="num">{s.rating}</div>
            <div className="lbl"><Stars value={s.rating} /><br />평가 {s.reviews}건</div>
          </div>
        </div>
      </Card>

      <Card>
        <h2>관서 평가 요약(샘플)</h2>
        <Bars rating={{ fair: s.rating, proc: s.rating + 0.2, att: s.rating - 0.3, comm: s.rating - 0.4, speed: s.rating - 0.1 }} />
        <p className="sub" style={{ marginTop: 8 }}>항목: 공정성 / 절차 준수 / 조사 태도 / 소통·응대 / 신속성 (각 5점)</p>
      </Card>

      <Card>
        <h2>소속 수사관</h2>
        <p className="sub" style={{ marginBottom: 10 }}>
          수사관 정보는 공개자료(인사발령 공고·관서 홈페이지·언론보도) 및 사건서류로 검증된 이용자 제보에 한해 게재되며,
          직무 관련 정보(성명·계급·소속)로 한정됩니다.
        </p>
        <table className="list">
          <thead>
            <tr><th>수사관</th><th>소속 부서</th><th>평균 평가</th><th>평가 수</th></tr>
          </thead>
          <tbody>
            {officers.length ? (
              officers.map((o) => {
                const avg = avgRating(o.rating);
                return (
                  <tr key={o.id} className="clickable" onClick={() => navigate(`/officer/${o.id}`)}>
                    <td><Link to={`/officer/${o.id}`}>{o.name} {o.rank}</Link><span className="tag">{o.src}</span></td>
                    <td>{o.dept}</td>
                    <td><Stars value={avg} /> {avg.toFixed(1)}</td>
                    <td>{o.n}건</td>
                  </tr>
                );
              })
            ) : (
              <tr><td colSpan={4} className="sub">등록된 수사관 정보가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
