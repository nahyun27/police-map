import { useNavigate, useParams } from 'react-router-dom';
import { Bars, Card, Crumb, Stars } from '../components/ui';
import { REVIEWS, avgRating, findOfficer, findStation } from '../data/sample';
import NotFound from './NotFound';

export default function OfficerPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const o = findOfficer(id);
  if (!o) return <NotFound />;
  const s = findStation(o.station)!;
  const reviews = REVIEWS.filter((r) => r.officer === o.id);
  const avg = avgRating(o.rating);

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: s.name, to: `/station/${s.id}` }, { label: `${o.name} ${o.rank}` }]} />
      <Card>
        <div className="flex">
          <div className="grow">
            <h1>{o.name} <span style={{ fontSize: 16, color: 'var(--sub)' }}>{o.rank}</span></h1>
            <p className="sub">{s.name} {o.dept}</p>
            <p className="sub" style={{ marginTop: 4 }}>
              정보 출처: {o.src} <span className="tag">직무 관련 공개정보만 게재</span>
            </p>
          </div>
          <div className="kpi">
            <div className="num">{avg.toFixed(1)}</div>
            <div className="lbl"><Stars value={avg} /><br />평가 {o.n}건</div>
          </div>
        </div>
        <hr className="divider" />
        <div className="grid2">
          <div>
            <h3>항목별 평가</h3>
            <Bars rating={o.rating} />
          </div>
          <div>
            <h3>소속 이력(공개자료 기준)</h3>
            <p className="sub">{o.history.map((h, i) => <span key={i}>{h}<br /></span>)}</p>
            <div style={{ marginTop: 14, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button className="btn" onClick={() => navigate(`/officer/${o.id}/write`)}>이 수사관 평가 작성</button>
              <button className="btn line sm" onClick={() => navigate(`/remedy/${o.id}`)}>민원·권리구제 안내</button>
              <button
                className="btn line sm"
                onClick={() => alert('데모: 당사자 삭제·정정 요청 절차 안내로 이동합니다.\n접수 즉시 해당 게시물은 임시조치(블라인드)됩니다.')}
              >
                삭제·정정 요청
              </button>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        <h2>평가 후기</h2>
        {reviews.length ? (
          reviews.map((rv, i) => (
            <div className="review" key={i}>
              <div className="meta">
                <span className="badge">{rv.role}</span><span className="badge">{rv.type}</span>{rv.date} · 검수 완료
              </div>
              <span className="stars">{'★'.repeat(rv.stars)}{'☆'.repeat(5 - rv.stars)}</span>
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
