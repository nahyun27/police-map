'use client';

import { useEffect } from 'react';

/** 화면에 들어올 때 data-reveal 요소를 아래에서 부드럽게 나타나게 한다(홈·소개 페이지).
 * 숨기는 규칙은 이 컴포넌트가 html 에 reveal-ready 를 붙인 뒤에만 걸리므로, 자바스크립트가 없거나
 * 검색엔진이 읽을 때는 처음부터 모두 보인다. 처음부터 화면 안에 있는 요소는 rv-static 으로 표시해 움직이지 않고 그대로 둔다.
 * data-reveal="stagger" 는 자식 카드들이 차례로 나타난다. 움직임 줄이기 설정이면 아무것도 하지 않는다. */
export function RevealOnScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      }
    }, { rootMargin: '0px 0px -8% 0px' });
    for (const el of els) {
      if (el.dataset.reveal === 'stagger') {
        Array.from(el.children).forEach((c, i) => (c as HTMLElement).style.setProperty('--i', String(Math.min(i, 8))));
      }
      const r = el.getBoundingClientRect();
      if (r.top < window.innerHeight && r.bottom > 0) el.classList.add('rv-static');
      else io.observe(el);
    }
    document.documentElement.classList.add('reveal-ready');
    return () => {
      io.disconnect();
      document.documentElement.classList.remove('reveal-ready');
    };
  }, []);
  return null;
}
