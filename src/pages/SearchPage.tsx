import { Link, useSearchParams } from 'react-router-dom';
import { Card } from '../components/ui';
import { OFFICERS, STATIONS, findStation } from '../data/sample';

export default function SearchPage() {
  const [params] = useSearchParams();
  const q = (params.get('q') ?? '').trim();
  const stations = STATIONS.filter((s) => s.name.includes(q));
  const officers = OFFICERS.filter((o) => o.name.includes(q) || o.dept.includes(q));

  return (
    <>
      <Card><h1>"{q}" 검색 결과</h1></Card>
      <Card>
        <h2>경찰서 ({stations.length})</h2>
        {stations.length ? stations.map((s) => (
          <div className="review" key={s.id}>
            <Link to={`/station/${s.id}`}>{s.name}</Link> <span className="sub">평가 {s.reviews}건</span>
          </div>
        )) : <p className="sub">결과 없음</p>}
      </Card>
      <Card>
        <h2>수사관 ({officers.length})</h2>
        {officers.length ? officers.map((o) => (
          <div className="review" key={o.id}>
            <Link to={`/officer/${o.id}`}>{o.name} {o.rank}</Link>{' '}
            <span className="sub">{findStation(o.station)?.name} {o.dept}</span>
          </div>
        )) : <p className="sub">결과 없음</p>}
      </Card>
    </>
  );
}
