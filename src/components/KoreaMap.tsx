'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import koreaMap from '@/data/koreaMap.json';
import type { RegionOut } from '@/lib/api';

interface KoreaMapProps {
  regions: RegionOut[];
}

/**
 * 남한 실제 지도(시·도경찰청 관할 18개 — 경기는 남부/북부로 분리) SVG.
 * 지역 경계 좌표는 통계청 행정구역 경계(2018, southkorea/southkorea-maps)를 바탕으로
 * turf.js 로 시군구를 관할별 병합·단순화한 뒤 d3-geo 로 투영해 만들었다(빌드 스크립트는
 * 저장소에 포함하지 않음 — 정적 좌표만 src/data/koreaMap.json 에 둔다).
 */
export default function KoreaMap({ regions }: KoreaMapProps) {
  const router = useRouter();
  const [hoverId, setHoverId] = useState<string | null>(null);
  const regionMap = new Map(regions.map((r) => [r.id, r]));
  const hovered = hoverId ? regionMap.get(hoverId) : undefined;

  return (
    <div className="korea-map-wrap">
      <svg
        viewBox={`0 0 ${koreaMap.width} ${koreaMap.height}`}
        className="korea-map"
        role="group"
        aria-label="시·도경찰청 관할 지도"
      >
        {koreaMap.features.map((f) => {
          const rg = regionMap.get(f.id);
          const active = hoverId === f.id;
          return (
            <path
              key={f.id}
              d={f.d}
              className={`kr-region${active ? ' active' : ''}${rg ? '' : ' empty'}`}
              tabIndex={rg ? 0 : -1}
              role={rg ? 'button' : undefined}
              aria-label={rg ? `${rg.name} — 등록 경찰서 ${rg.station_count}곳` : undefined}
              onMouseEnter={() => rg && setHoverId(f.id)}
              onMouseLeave={() => setHoverId((cur) => (cur === f.id ? null : cur))}
              onFocus={() => rg && setHoverId(f.id)}
              onBlur={() => setHoverId((cur) => (cur === f.id ? null : cur))}
              onClick={() => rg && router.push(`/region/${rg.id}`)}
              onKeyDown={(e) => {
                if (rg && (e.key === 'Enter' || e.key === ' ')) {
                  e.preventDefault();
                  router.push(`/region/${rg.id}`);
                }
              }}
            />
          );
        })}
      </svg>
      <div className="korea-map-tip" aria-live="polite">
        {hovered ? (
          <><b>{hovered.name}</b><span className="sub"> · {hovered.station_count}개 관서</span></>
        ) : (
          <span className="sub">지역을 선택하면 관할 경찰서 목록으로 이동합니다.</span>
        )}
      </div>
    </div>
  );
}
