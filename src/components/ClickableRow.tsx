'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';

/** 행 전체를 클릭하면 이동하는 표 행. 키보드 접근은 행 안의 링크가 담당한다. */
export default function ClickableRow({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr className="clickable" onClick={() => router.push(href)}>
      {children}
    </tr>
  );
}
