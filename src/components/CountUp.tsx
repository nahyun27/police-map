'use client';

import { useEffect, useRef, useState } from 'react';

/** 숫자가 0 에서 목표값까지 짧게 올라가는 표시(홈·통계 수치). 서버 렌더와 검색엔진에는 처음부터 최종값이 보이고,
 * 화면에 보일 때 한 번만 움직인다. 움직임 줄이기 설정을 켠 사용자에게는 바로 최종값을 보여 준다. */
export function CountUp({ value, duration = 900 }: { value: number; duration?: number }) {
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || value <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    // 처음부터 화면에 보이는 숫자는 그대로 둔다(최종값이 보였다가 0 으로 돌아가 다시 오르는 깜빡임 방지).
    const r = el.getBoundingClientRect();
    if (r.top < window.innerHeight && r.bottom > 0) return;
    let raf = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const t = Math.min(1, (now - start) / duration);
        setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
        if (t < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    setShown(0);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) { io.disconnect(); run(); }
    });
    io.observe(el);
    return () => { io.disconnect(); cancelAnimationFrame(raf); };
  }, [value, duration]);

  return <span ref={ref}>{shown.toLocaleString('ko-KR')}</span>;
}
