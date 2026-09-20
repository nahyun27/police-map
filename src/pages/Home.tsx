import { Link, useNavigate } from 'react-router-dom';
import { Card } from '../components/ui';
import { REGIONS, REVIEWS, TILE, findOfficer, findStation } from '../data/sample';

export default function Home() {
  const navigate = useNavigate();

  return (
    <>
      <Card className="hero">
        <h1 style={{ fontSize: 27 }}>수사 절차의 투명성, 국민이 만듭니다</h1>
        <p style={{ opacity: 0.85, maxWidth: 640 }}>
          전국 경찰관서·수사부서의 공개정보와 수사 절차를 직접 경험한 국민의 구조화된 평가를 한곳에 모았습니다.
          비방이 아닌 <b>직무수행에 대한 사실 기반 평가</b>, 그리고 <b>권리구제 절차 안내</b>를 제공합니다.
        </p>
        <div style={{ marginTop: 14, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn gold" onClick={() => navigate('/remedy')}>권리구제 내비게이터</button>
          <button className="btn ghost" onClick={() => navigate('/guide')}>기피신청 안내</button>
          <button className="btn ghost" onClick={() => navigate('/stats')}>전국 통계</button>
        </div>
      </Card>

      <div className="grid3">
        <Card className="kpi"><div className="num">258</div><div className="lbl">등록 경찰서(샘플)</div></Card>
        <Card className="kpi"><div className="num">1,742</div><div className="lbl">수사부서(샘플)</div></Card>
        <Card className="kpi"><div className="num">12,308</div><div className="lbl">누적 평가(샘플)</div></Card>
      </div>

      <div className="grid2">
        <Card>
          <h2>지도에서 찾기</h2>
          <p className="sub">시·도경찰청을 선택하면 관할 경찰서 목록으로 이동합니다.</p>
          <div className="tilemap">
            {TILE.map((id, i) => {
              const rg = REGIONS.find((r) => r.id === id);
              if (!rg) return <div key={i} className="tile empty" />;
              return (
                <Link key={i} to={`/region/${rg.id}`} className="tile">
                  <b>{rg.name}</b>
                  <small>{rg.stations}서</small>
                </Link>
              );
            })}
          </div>
        </Card>

        <Card>
          <h2>최근 등록된 평가</h2>
          <p className="sub">모든 평가는 작성 후 검수(24~48시간)를 거쳐 게시됩니다.</p>
          {REVIEWS.slice(0, 3).map((rv, i) => {
            const o = findOfficer(rv.officer)!;
            const s = findStation(o.station)!;
            return (
              <div className="review" key={i}>
                <div className="meta">{s.name} · {o.dept} · {rv.role} · {rv.date}</div>
                <span className="stars">{'★'.repeat(rv.stars)}{'☆'.repeat(5 - rv.stars)}</span>{' '}
                {rv.text.slice(0, 80)}… <Link to={`/officer/${o.id}`}>더보기</Link>
              </div>
            );
          })}
          <hr className="divider" />
          <h3>공지</h3>
          <p className="sub">
            · [안내] 평가는 사건관계인·변호인만 작성할 수 있습니다.<br />
            · [안내] 당사자 삭제·정정 요청 창구를 운영합니다. 접수 즉시 임시조치됩니다.<br />
            · [발간] 2026 상반기 수사기관 평가 리포트(샘플)
          </p>
        </Card>
      </div>
    </>
  );
}
