'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { apiAsset } from '@/lib/api';

/** 자체 방문 통계 수집(backend/app/api/v1/analytics.py). 페이지가 바뀔 때마다 주소(검색어 등 쿼리 제외는 서버에서)와
 * 들어온 외부 사이트만 보낸다. 쿠키·외부 분석 도구는 쓰지 않는다. 실패해도 화면에는 아무 영향이 없게 조용히 무시한다. */
export default function PageViewTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith('/admin')) return;
    // 외부 유입 주소는 사이트에 처음 들어온 페이지에서만 의미가 있다(사이트 안에서 이동하면 document.referrer 가 그대로라 중복 집계됨).
    const first = !(window as { __pmTracked?: boolean }).__pmTracked;
    (window as { __pmTracked?: boolean }).__pmTracked = true;
    fetch(apiAsset('/api/v1/track'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: pathname, referrer: first ? document.referrer || null : null }),
      keepalive: true,
      credentials: 'omit',
    }).catch(() => {});
  }, [pathname]);
  return null;
}
