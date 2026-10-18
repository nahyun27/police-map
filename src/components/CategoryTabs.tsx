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
  // 모바일에서 탭이 화면보다 길면 오른쪽 끝을 흐리게 해서 "옆으로 더 있다"는 걸 보여준다.
  const [moreRight, setMoreRight] = useState(false);

  useEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    const activeEl = nav.querySelector<HTMLElement>(`[data-tab-key="${active}"]`);
    if (activeEl) {
      setIndicator({ left: activeEl.offsetLeft, width: activeEl.offsetWidth });
      // 선택된 탭이 잘려 있으면 보이는 곳으로 끌어온다(예: 맨 끝 "평가" 탭을 고른 경우).
      if (activeEl.offsetLeft + activeEl.offsetWidth > nav.clientWidth + nav.scrollLeft) {
        nav.scrollLeft = activeEl.offsetLeft - 8;
      }
    }
    const check = () => setMoreRight(nav.scrollWidth - nav.clientWidth - nav.scrollLeft > 4);
    check();
    nav.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check);
    return () => { nav.removeEventListener('scroll', check); window.removeEventListener('resize', check); };
  }, [active]);

  return (
    <nav className={`cat-tabs${moreRight ? ' has-more' : ''}`} aria-label="글머리 선택" ref={navRef}>
      {indicator && (
        <span className="cat-tabs-indicator" style={{ transform: `translateX(${indicator.left}px)`, width: indicator.width }} />
      )}
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} data-tab-key={t.key} className={active === t.key ? 'on' : ''}>{t.label}</Link>
      ))}
    </nav>
  );
}
