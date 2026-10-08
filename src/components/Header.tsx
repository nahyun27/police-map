'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { MapPinned, Menu, Search, User, X } from 'lucide-react';
import { getMe, type UserOut } from '@/lib/api';

const NAV = [
  { to: '/', label: '지도 탐색', end: true },
  { to: '/board', label: '커뮤니티' },
  { to: '/why', label: '폴리스맵 소개' },
  { to: '/stats', label: '통계' },
  { to: '/remedy', label: '권리구제' },
  { to: '/report', label: '제보' },
  { to: '/policy', label: '운영원칙' },
];

export default function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState<UserOut | null | undefined>(undefined); // undefined=확인 중

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    getMe().then(setUser).catch(() => setUser(null));
  }, [pathname]);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  const isActive = (to: string, end?: boolean) => (end ? pathname === to : pathname === to || pathname.startsWith(`${to}/`));

  return (
    <header className="site-header">
      <div className="hwrap">
        <Link href="/" className="logo">
          <span className="logo-mark"><MapPinned size={18} /></span>
          <span>폴리스<em>맵</em></span>
        </Link>
        <button className="menu-btn" onClick={() => setOpen((v) => !v)} aria-label="메뉴" aria-expanded={open}>
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
        <div className={`hpanel${open ? ' open' : ''}`}>
          <nav className="gnb">
            {NAV.map((n) => (
              <Link key={n.to} href={n.to} className={isActive(n.to, n.end) ? 'active' : ''}>
                {n.label}
              </Link>
            ))}
          </nav>
          <form className="hsearch" onSubmit={onSearch} role="search">
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="경찰서·수사관 검색" aria-label="검색" />
          </form>
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
