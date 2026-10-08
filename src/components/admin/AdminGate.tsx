'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';
import { Card } from '@/components/ui';
import { getMe, logout, type UserOut } from '@/lib/api';

const TABS = [
  { href: '/admin', label: '평가 검수' },
  { href: '/admin/reports', label: '신고' },
  { href: '/admin/takedowns', label: '삭제·정정 요청' },
  { href: '/admin/officer-verifications', label: '경찰관 인증' },
  { href: '/admin/audit-log', label: '처리 기록' },
];

type State = { status: 'loading' } | { status: 'unauthorized' } | { status: 'forbidden'; user: UserOut } | { status: 'ok'; user: UserOut };

/** /admin 대시보드 페이지를 감싼다. 관리자 로그인이 없으면 /admin/login 으로 보낸다. */
export default function AdminGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [state, setState] = useState<State>({ status: 'loading' });

  const check = useCallback(async () => {
    try {
      const user = await getMe();
      setState(user.role === 'admin' ? { status: 'ok', user } : { status: 'forbidden', user });
    } catch {
      setState({ status: 'unauthorized' });
    }
  }, []);

  useEffect(() => { check(); }, [check]);

  useEffect(() => {
    if (state.status === 'unauthorized') router.replace(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }, [state.status, router, pathname]);

  if (state.status === 'loading' || state.status === 'unauthorized') {
    return <Card><p className="sub">확인 중…</p></Card>;
  }
  if (state.status === 'forbidden') {
    return (
      <Card>
        <h1 style={{ fontSize: 22 }}>관리자 권한이 필요합니다</h1>
        <p className="sub" style={{ marginTop: 8 }}>{state.user.email} 계정은 관리자가 아닙니다.</p>
      </Card>
    );
  }

  return (
    <>
      <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 20 }}>
        <nav className="gnb" style={{ background: '#fff', border: '1px solid var(--line)', borderRadius: 12, padding: 4 }}>
          {TABS.map((t) => (
            <Link key={t.href} href={t.href} className={pathname === t.href ? 'active' : ''}>{t.label}</Link>
          ))}
        </nav>
        <div className="flex" style={{ gap: 12 }}>
          <span className="sub">{state.user.nickname}({state.user.email})</span>
          <button className="btn line sm" onClick={async () => { await logout(); router.replace('/admin/login'); }}>
            <LogOut size={14} />로그아웃
          </button>
        </div>
      </div>
      {children}
    </>
  );
}
