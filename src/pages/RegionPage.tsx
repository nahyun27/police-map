import { Link, useNavigate, useParams } from 'react-router-dom';
import { Card, Crumb, Stars } from '../components/ui';
import { STATIONS, findRegion } from '../data/sample';
import NotFound from './NotFound';

export default function RegionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const rg = findRegion(id);
  if (!rg) return <NotFound />;
  const list = STATIONS.filter((s) => s.region === rg.id);

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: rg.full }]} />
      <Card>
        <h1>{rg.full}</h1>
        <p className="sub">관할 경찰서 {rg.stations}개 · 평가 데이터는 관서 → 부서 → 수사관 순으로 탐색할 수 있습니다.</p>
      </Card>
      <Card>
        <table className="list">
          <thead>
            <tr><th>경찰서</th><th>수사부서</th><th>평균 평가</th><th>평가 수</th></tr>
          </thead>
          <tbody>
            {list.length ? (
              list.map((s) => (
                <tr key={s.id} className="clickable" onClick={() => navigate(`/station/${s.id}`)}>
                  <td><Link to={`/station/${s.id}`}>{s.name}</Link></td>
                  <td>{s.depts.length}개 부서</td>
                  <td><Stars value={s.rating} /> {s.rating}</td>
                  <td>{s.reviews}건</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="sub">
                  데모에서는 이 지역 샘플 데이터가 없습니다. (실서비스: {rg.stations}개 관서)
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}
