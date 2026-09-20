import Link from 'next/link';
import { ArrowRight, BarChart3, ChevronRight, Scale, ShieldCheck } from 'lucide-react';
import HeroSearch from '@/components/HeroSearch';
import { Bars, Card, Score, Stars } from '@/components/ui';
import { REGIONS, REVIEWS, STATIONS, TILE, findOfficer, findStation } from '@/data/sample';

const FEATURES = [
  { to: '/policy', icon: ShieldCheck, title: '사실 기반 평가', body: '직무수행에 대한 구조화된 평가만 선검수 후 게시합니다. 인신공격과 사생활 정보는 게재하지 않습니다.', more: '운영원칙 보기' },
  { to: '/remedy', icon: Scale, title: '권리구제 내비게이터', body: '후기에서 멈추지 않도록, 겪은 문제에 맞는 공식 절차와 접수처를 안내합니다.', more: '내 상황에 맞는 절차 찾기' },
  { to: '/stats', icon: BarChart3, title: '공개 통계', body: '이용자 평가와 정보공개청구로 확보한 기피신청·수용률 통계를 함께 제공합니다.', more: '전국 통계 보기' },
];

const REGIONS_WITH_DATA = new Set(STATIONS.map((s) => s.region));

export default function Home() {
  return (
    <>
      <section className="card hero">
        <div className="eyebrow">국민 참여형 수사기관 평가 플랫폼</div>
        <h1>수사 절차의 투명성,<br /><em>국민이 만듭니다</em></h1>
        <p className="lead">
          전국 경찰관서·수사부서의 공개정보와 수사 절차를 직접 경험한 국민의 구조화된 평가를 한곳에 모았습니다.
          비방이 아닌 직무수행에 대한 사실 기반 평가, 그리고 권리구제 절차 안내를 제공합니다.
        </p>

        <HeroSearch />

        <div className="quick">
          <Link href="/remedy" className="btn ghost sm">권리구제 내비게이터 <ArrowRight size={14} /></Link>
          <Link href="/guide" className="btn ghost sm">기피신청 안내</Link>
          <Link href="/stats" className="btn ghost sm">전국 통계</Link>
        </div>

        <div className="hero-card" aria-hidden="true">
          <div className="hc-top"><i />평가 미리보기 · 샘플</div>
          <div className="hc-title">서울강남경찰서(샘플)</div>
          <div className="hc-score"><b>3.4</b><Stars value={3.4} /></div>
          <Bars rating={{ fair: 3.4, proc: 3.6, att: 3.1, comm: 3.0, speed: 3.3 }} />
        </div>

        <div className="hero-stats">
          <div><div className="num">258</div><div className="lbl">등록 경찰서(샘플)</div></div>
          <div><div className="num">1,742</div><div className="lbl">수사부서(샘플)</div></div>
          <div><div className="num">12,308</div><div className="lbl">누적 평가(샘플)</div></div>
        </div>
      </section>

      <div className="grid2">
        <Card>
          <h2>지도에서 찾기</h2>
          <p className="sub">시·도경찰청을 선택하면 관할 경찰서 목록으로 이동합니다.</p>
          <div className="tilemap">
            {TILE.map((id, i) => {
              const rg = REGIONS.find((r) => r.id === id);
              if (!rg) return <div key={i} className="tile empty" />;
              return (
                <Link key={i} href={`/region/${rg.id}`} className={`tile${REGIONS_WITH_DATA.has(rg.id) ? ' has' : ''}`}>
                  <b>{rg.name}</b>
                  <small>{rg.stations}서</small>
                </Link>
              );
            })}
          </div>
          <div className="legend">
            <span><i className="has" />샘플 데이터 있음</span>
            <span><i />준비 중</span>
          </div>
        </Card>

        <Card>
          <div className="sec-head">
            <div>
              <h2 style={{ marginBottom: 4 }}>최근 등록된 평가</h2>
              <p className="sub">모든 평가는 작성 후 검수(24~48시간)를 거쳐 게시됩니다.</p>
            </div>
          </div>
          {REVIEWS.slice(0, 3).map((rv, i) => {
            const o = findOfficer(rv.officer)!;
            const s = findStation(o.station)!;
            return (
              <div className="review" key={i}>
                <div className="meta">
                  <span className="badge">{rv.role}</span>{s.name} · {o.dept} · {rv.date}
                </div>
                <div className="head"><Score value={rv.stars} /></div>
                <p>{rv.text.slice(0, 78)}… <Link href={`/officer/${o.id}`}>더보기</Link></p>
              </div>
            );
          })}
        </Card>
      </div>

      <div className="grid3">
        {FEATURES.map(({ to, icon: Icon, title, body, more }) => (
          <Link key={to} href={to} className="card clickable-card feature">
            <div className="ico"><Icon size={22} /></div>
            <h3>{title}</h3>
            <p>{body}</p>
            <span className="more">{more} <ChevronRight size={15} /></span>
          </Link>
        ))}
      </div>

      <Card className="flat">
        <h3>공지</h3>
        <div className="notice">
          <div><em>안내</em>평가는 사건관계인·변호인만 작성할 수 있습니다.</div>
          <div><em>안내</em>당사자 삭제·정정 요청 창구를 운영합니다. 접수 즉시 임시조치됩니다.</div>
          <div><em>발간</em>2026 상반기 수사기관 평가 리포트(샘플)</div>
        </div>
      </Card>
    </>
  );
}
