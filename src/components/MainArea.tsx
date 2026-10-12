'use client';

import { usePathname } from 'next/navigation';

/** 관리자 콘솔(AdminShell)은 사이드바가 꽉 찬 폭을 쓰는 별개의 레이아웃이라,
 * 공개 사이트용 <main> 의 가운데 정렬 컨테이너·여백을 걷어낸다. */
export default function MainArea({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return <main className={pathname.startsWith('/admin') ? 'main-admin' : undefined}>{children}</main>;
}
