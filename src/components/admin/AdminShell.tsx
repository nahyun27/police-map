'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BadgeCheck, ClipboardCheck, EyeOff, FileX, Flag, History, Image, LayoutDashboard, LogOut, Mail, Megaphone, Menu, Users,
} from 'lucide-react';
import { resetAdminCheck } from '@/components/AdminBlindButton';
import { ApiError, getMe, logout, type UserOut } from '@/lib/api';

const NAV = [
  { href: '/admin', label: '대시보드', icon: LayoutDashboard },
  { href: '/admin/reviews', label: '평가 검수', icon: ClipboardCheck },
  { href: '/admin/reports', label: '신고', icon: Flag },
  { href: '/admin/blinded', label: '블라인드 게시물', icon: EyeOff },
  { href: '/admin/cases', label: '사건 공론화', icon: Megaphone },
  { href: '/admin/takedowns', label: '삭제·정정 요청', icon: FileX },
  { href: '/admin/officer-verifications', label: '경찰관 인증', icon: BadgeCheck },
  { href: '/admin/users', label: '회원 관리', icon: Users },
  { href: '/admin/ads', label: '광고 관리', icon: Image },
  { href: '/admin/inquiries', label: '광고·제휴 문의', icon: Mail },
  { href: '/admin/audit-log', label: '처리 기록', icon: History },
];

type State =
  | { status: 'loading' } | { status: 'unauthorized' } | { status: 'error' }
  | { status: 'forbidden'; user: UserOut } | { status: 'ok'; user: UserOut };

/** 관리자 콘솔 전체를 감싸는 고정 사이드바 셸. 로그인/권한 확인도 여기서 같이 한다
 * (기존 AdminGate 의 역할을 이어받음 — 관리자 로그인이 없으면 /admin/login 으로 보낸다). */
export default function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [navOpen, setNavOpen] = useState(false);

  const check = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const user = await getMe();
      setState(user.role === 'admin' ? { status: 'ok', user } : { status: 'forbidden', user });
    } catch (e) {
      // 로그인 화면으로 보내는 건 세션이 정말 없을 때(401/403)만이다. 서버가 잠깐 죽었거나 연결이
      // 끊긴 걸 "로그아웃됨"으로 취급하면, 작업 중이던 관리자가 영문도 모르고 로그인 화면으로 튕긴다.
      setState(e instanceof ApiError && (e.status === 401 || e.status === 403) ? { status: 'unauthorized' } : { status: 'error' });
    }
  }, []);

  useEffect(() => { check(); }, [check]);
  useEffect(() => { setNavOpen(false); }, [pathname]);

  useEffect(() => {
    if (state.status === 'unauthorized') router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }, [state.status, router, pathname]);

  if (state.status === 'loading' || state.status === 'unauthorized') {
    return <div className="admin-checking"><p className="sub">확인 중…</p></div>;
  }
  if (state.status === 'error') {
    return (
      <div className="admin-denied">
        <div className="card" style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 20 }}>로그인 상태를 확인하지 못했습니다</h1>
          <p className="sub" style={{ marginTop: 8 }}>서버에 연결할 수 없거나 일시적인 오류입니다. 잠시 후 다시 시도해 주세요.</p>
          <button type="button" className="btn sm" style={{ marginTop: 12 }} onClick={check}>다시 시도</button>
        </div>
      </div>
    );
  }
  if (state.status === 'forbidden') {
    return (
      <div className="admin-denied">
        <div className="card" style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 20 }}>관리자 권한이 필요합니다</h1>
          <p className="sub" style={{ marginTop: 8 }}>{state.user.email} 계정은 관리자가 아닙니다.</p>
        </div>
      </div>
    );
  }

  const current = NAV.find((n) => (n.href === '/admin' ? pathname === n.href : pathname.startsWith(n.href)));
  const user = state.user;
  // 로그아웃 요청이 실패해도(이미 세션 만료 등) 처리되지 않은 Promise 거부로 남기지 않고 로그인 화면으로 보낸다.
  const doLogout = async () => {
    await logout().catch(() => {});
    resetAdminCheck();
    router.replace('/admin/login');
  };

  const navLinks = (
    <nav className="admin-nav">
      {NAV.map((n) => {
        const active = n.href === '/admin' ? pathname === n.href : pathname.startsWith(n.href);
        const Icon = n.icon;
        return (
          <Link key={n.href} href={n.href} className={active ? 'active' : ''}>
            <Icon size={16} />{n.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="admin-shell">
      <div className="admin-topbar">
        <button type="button" onClick={() => setNavOpen(true)} aria-label="메뉴 열기"><Menu size={20} /></button>
        <b>폴리스맵 운영 콘솔</b>
      </div>

      {navOpen && <div className="admin-overlay" onClick={() => setNavOpen(false)} />}

      <aside className={`admin-sidebar${navOpen ? ' open' : ''}`}>
        <div className="admin-sidebar-brand">
          {/* eslint-disable-next-line @next/next/no-img-element -- 작은 고정 아이콘 */}
          <span className="mark"><img src="/images/logo-mark.png" alt="" width={22} height={22} /></span>
          <div>
            <b>폴리스맵</b>
            <span>운영 콘솔</span>
          </div>
        </div>
        {navLinks}
        <div className="admin-sidebar-foot">
          <span className="who">{user.nickname}<br />{user.email}</span>
          <button type="button" onClick={doLogout}><LogOut size={14} />로그아웃</button>
        </div>
      </aside>

      <div className="admin-main">
        <div className="admin-content">
          <div className="admin-pagehead">
            <h1>{current?.label ?? '운영 콘솔'}</h1>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
