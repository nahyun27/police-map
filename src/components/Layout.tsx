import { useEffect, useState, type FormEvent } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

const NAV = [
  { to: '/', label: '지도 탐색', end: true },
  { to: '/stats', label: '통계' },
  { to: '/guide', label: '권리구제 안내' },
  { to: '/remedy', label: '민원 연계' },
  { to: '/policy', label: '운영원칙' },
];

function Header() {
  const navigate = useNavigate();
  const [q, setQ] = useState('');

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term) navigate(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <header className="site">
      <div className="hwrap">
        <Link to="/" className="logo">폴리스<span>맵</span></Link>
        <nav className="gnb">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'active' : '')}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <form className="search" onSubmit={onSearch}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="경찰서·수사관 검색" />
          <button type="submit">검색</button>
        </form>
      </div>
    </header>
  );
}

function Footer() {
  return (
    <footer className="site">
      폴리스맵(가칭) 프로토타입 · 국민 참여형 수사기관 평가 플랫폼<br />
      <Link to="/policy">이용약관</Link> · <Link to="/policy">커뮤니티 가이드라인</Link> ·{' '}
      <Link to="/policy">개인정보처리방침</Link> · <Link to="/policy">삭제·정정 요청</Link><br />
      본 사이트는 공무집행의 투명성 제고라는 공익 목적으로 직무수행 관련 정보만을 다루며, 사생활 정보는 게재하지 않습니다.
    </footer>
  );
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => window.scrollTo(0, 0), [pathname]);
  return null;
}

export default function Layout() {
  return (
    <>
      <ScrollToTop />
      <div className="demo-banner">
        ⚠ 데모 프로토타입 — 본 화면의 모든 관서·인물·평가·통계는 <b>가상의 샘플 데이터</b>이며 실존 인물·기관과 무관합니다.
      </div>
      <Header />
      <main><Outlet /></main>
      <Footer />
    </>
  );
}
