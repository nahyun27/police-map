'use client';

import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronDown, Menu, Search, User, X } from 'lucide-react';
import { getMe, type UserOut } from '@/lib/api';
import { useSearchSuggestions } from '@/lib/useSearchSuggestions';

const NAV = [
  { to: '/board', label: '커뮤니티' },
  {
    to: '/why', label: '폴리스맵 소개',
    children: [{ to: '/why', label: '소개' }, { to: '/policy', label: '운영원칙' }],
  },
  { to: '/stats', label: '통계' },
  { to: '/remedy', label: '권리구제' },
  { to: '/report', label: '제보' },
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

  useEffect(() => {
    getMe().then(setUser).catch(() => setUser(null));
  }, [pathname]);

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
    <header className="site-header">
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
                placeholder="경찰서·수사관 검색" aria-label="검색"
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
              <Link href="/mypage" className="hauth-user"><User size={15} />{user.nickname}님</Link>
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
