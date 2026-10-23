'use client';

import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, LogOut, Menu, Search, User, X } from 'lucide-react';
import { resetAdminCheck } from '@/components/AdminBlindButton';
import { MAX_SEARCH_LEN, getMe, logout, type UserOut } from '@/lib/api';
import { useSearchSuggestions } from '@/lib/useSearchSuggestions';

const NAV = [
  { to: '/board', label: '커뮤니티' },
  { to: '/cases', label: '사건 공론화' },
  {
    to: '/why', label: '폴리스맵 소개',
    children: [{ to: '/why', label: '소개' }, { to: '/policy', label: '운영원칙' }],
  },
  { to: '/remedy', label: '권리구제' },
  { to: '/report', label: '제보' },
  { to: '/stats', label: '통계' },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { items: suggestions, loading: suggestLoading } = useSearchSuggestions(q, suggestOpen);
  const [user, setUser] = useState<UserOut | null | undefined>(undefined); // undefined=확인 중

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // 스크롤하면 헤더 아래에 옅은 그림자를 줘서 본문과 분리한다(globals.css 의 .site-header.scrolled).
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    getMe().then(setUser).catch(() => setUser(null));
  }, [pathname]);

  // 로그아웃이 마이페이지 안에만 있어 공용 PC 등에서 찾기 어려웠다. 상단·모바일 메뉴에서도 바로 할 수 있게 한다.
  const doLogout = async () => {
    await logout().catch(() => {});
    resetAdminCheck();
    setUser(null);
    setOpen(false);
    // 마이페이지·글쓰기처럼 로그인한 사람의 데이터를 브라우저에서 불러와 들고 있는 화면은
    // router.refresh() 로는 서버 컴포넌트만 다시 그려지고 클라이언트 상태(내 글 목록, 작성 중인 폼 등)가
    // 그대로 남는다. 공용 PC 에서 다음 사람이 그대로 볼 수 있으니 이런 화면에선 홈으로 새로 고침해 나간다.
    const privatePage = /^\/(mypage|officer-verify|cases\/new|board\/write)(\/|$)|^\/station\/[^/]+\/write(\/|$)/;
    if (privatePage.test(window.location.pathname)) {
      window.location.href = '/';
      return;
    }
    router.refresh();
  };

  const goStation = (id: number) => {
    setSuggestOpen(false);
    router.push(`/station/${id}`);
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term) { setSuggestOpen(false); router.push(`/search?q=${encodeURIComponent(term)}`); }
  };

  const onSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!suggestOpen || !suggestions.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % suggestions.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); goStation(suggestions[active].id); }
    else if (e.key === 'Escape') setSuggestOpen(false);
  };

  const isActive = (to: string, end?: boolean) => (end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));

  // 관리자 콘솔은 전용 사이드바 셸(AdminShell)을 따로 쓰는 별개의 "앱" 화면이라
  // 공개 사이트의 상단 내비게이션을 같이 보여주지 않는다.
  if (pathname.startsWith('/admin')) return null;

  return (
    <header className={`site-header${scrolled ? ' scrolled' : ''}`}>
      <div className="hwrap">
        <Link href="/" className="logo">
          <Image src="/images/logo.webp" alt="폴리스맵" width={213} height={72} className="logo-img" priority />
        </Link>
        <button className="menu-btn" onClick={() => setOpen((v) => !v)} aria-label="메뉴" aria-expanded={open}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className={`hpanel${open ? ' open' : ''}`}>
          <nav className="gnb">
            {NAV.map((n) =>
              n.children ? (
                <div key={n.to} className="gnb-drop">
                  <Link
                    href={n.to}
                    className={n.children.some((c) => isActive(c.to)) ? 'active' : ''}
                  >
                    {n.label}<ChevronDown size={13} />
                  </Link>
                  <div className="gnb-drop-menu">
                    {n.children.map((c) => (
                      <Link key={c.to} href={c.to} className={isActive(c.to) ? 'active' : ''}>
                        {c.label}
                      </Link>
                    ))}
                  </div>
                </div>
              ) : (
                <Link key={n.to} href={n.to} className={isActive(n.to) ? 'active' : ''}>
                  {n.label}
                </Link>
              )
            )}
          </nav>
          <div className="hsearch-wrap">
            <form className="hsearch" onSubmit={onSearch} role="search">
              <Search size={16} />
              <input
                value={q}
                onChange={(e) => { setQ(e.target.value); setSuggestOpen(true); setActive(-1); }}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => setTimeout(() => setSuggestOpen(false), 120)}
                onKeyDown={onSearchKeyDown}
                placeholder="경찰서 검색" aria-label="경찰서 검색" maxLength={MAX_SEARCH_LEN}
                role="combobox" aria-expanded={suggestOpen && suggestions.length > 0} aria-autocomplete="list"
                autoComplete="off"
              />
            </form>
            {suggestOpen && q.trim() && (suggestions.length > 0 || suggestLoading) && (
              <ul className="search-suggest">
                {suggestions.map((s, i) => (
                  <li key={s.id}>
                    <button
                      type="button" className={i === active ? 'active' : ''}
                      onMouseDown={() => goStation(s.id)} onMouseEnter={() => setActive(i)}
                    >
                      <b>{s.name}</b><span className="sub">{s.address ?? '주소 정보 없음'}</span>
                    </button>
                  </li>
                ))}
                {suggestLoading && !suggestions.length && <li className="search-suggest-empty">검색 중…</li>}
              </ul>
            )}
          </div>
          <div className="hauth">
            {user === undefined ? null : user ? (
              <>
                <Link href="/mypage" className="hauth-user"><User size={15} />{user.nickname}님</Link>
                <button type="button" className="hauth-logout" onClick={doLogout}>
                  <LogOut size={14} style={{ verticalAlign: -2, marginRight: 4 }} />로그아웃
                </button>
              </>
            ) : (
              <>
                <Link href="/login">로그인</Link>
                <Link href="/signup" className="btn sm">회원가입</Link>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
