'use client';

import type { ReactNode } from 'react';

/** 백엔드 연동 전 데모용 — 클릭 시 안내창을 띄운다. */
export default function DemoAlertButton({ message, className = 'btn line', children }: { message: string; className?: string; children: ReactNode }) {
  return (
    <button className={className} onClick={() => alert(message)}>
      {children}
    </button>
  );
}
