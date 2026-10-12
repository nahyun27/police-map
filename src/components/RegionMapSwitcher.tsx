'use client';

import { useState } from 'react';
import KoreaMap from '@/components/KoreaMap';
import RegionGridMap from '@/components/RegionGridMap';
import type { RegionOut } from '@/lib/api';

/** 실지도 ↔ 간소화(타일 격자) 두 보기를 토글하는 래퍼. 두 버튼 중 아무 쪽을 눌러도 그
 * 뷰로 전환되고(배타적 선택), 토글 영역에 마우스를 올리면 버튼 둘 다 같이 하이라이트된다
 * (짝인 버튼이라는 느낌만 주는 용도 — 실제 전환은 클릭해야만 일어난다, 2026-10 결정). */
export default function RegionMapSwitcher({ regions }: { regions: RegionOut[] }) {
  const [mode, setMode] = useState<'real' | 'grid'>('real');

  return (
    <div className="region-map-switcher">
      <div className="map-toggle" role="tablist" aria-label="지도 보기 방식">
        <button
          type="button" role="tab" aria-selected={mode === 'real'}
          className={mode === 'real' ? 'active' : ''} onClick={() => setMode('real')}
        >
          실지도
        </button>
        <button
          type="button" role="tab" aria-selected={mode === 'grid'}
          className={mode === 'grid' ? 'active' : ''} onClick={() => setMode('grid')}
        >
          간소화
        </button>
      </div>
      {mode === 'real' ? <KoreaMap regions={regions} /> : <RegionGridMap regions={regions} />}
    </div>
  );
}
