'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * 커뮤니티 글머리 탭. 그냥 Link 나열이면 탭이 바뀔 때 뚝뚝 끊겨 보여서, 흰 알약 배경을
 * 별도 레이어(.cat-tabs-indicator)로 떼어내 현재 탭 위치로 슬라이드시킨다. 탭 자체는
 * 여전히 Link 라 URL 네비게이션 동작은 그대로다 — 위치만 useLayoutEffect 로 측정해서
 * CSS transform 으로 옮긴다.
 */
export function CategoryTabs({ tabs, active }: { tabs: { key: string; label: string; href: string }[]; active: string }) {
  const navRef = useRef<HTMLElement>(null);
  const [indicator, setIndicator] = useState<{ left: number; width: number } | null>(null);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const activeEl = nav.querySelector<HTMLElement>(`[data-tab-key="${active}"]`);
    if (activeEl) setIndicator({ left: activeEl.offsetLeft, width: activeEl.offsetWidth });
  }, [active]);

  return (
    <nav className="cat-tabs" aria-label="글머리 선택" ref={navRef}>
      {indicator && (
        <span className="cat-tabs-indicator" style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }} />
      )}
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} data-tab-key={t.key} className={active === t.key ? 'on' : ''}>{t.label}</Link>
      ))}
    </nav>
  );
}
