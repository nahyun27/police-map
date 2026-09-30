'use client';

import { useRef, useState, type MouseEvent } from 'react';
import { useRouter } from 'next/navigation';
import koreaMap from '@/data/koreaMap.json';
import type { RegionOut } from '@/lib/api';

interface KoreaMapProps {
  regions: RegionOut[];
}

/**
 * 남한 실제 지도(시·도경찰청 관할 18개, 경기는 남부/북부로 분리) SVG.
 * 지역 경계 좌표는 통계청 행정구역 경계(2018, southkorea/southkorea-maps)를 바탕으로
 * turf.js 로 시군구를 관할별 병합·단순화한 뒤 d3-geo 로 투영해 만들었다(빌드 스크립트는
 * 저장소에 포함하지 않음, 정적 좌표만 src/data/koreaMap.json 에 둔다).
 */
export default function KoreaMap({ regions }: KoreaMapProps) {
  const router = useRouter();
  const wrapRef = useRef<HTMLDivElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [tipPos, setTipPos] = useState<{ x: number; y: number } | null>(null);
  const regionMap = new Map(regions.map((r) => [r.id, r]));
  const hovered = hoverId ? regionMap.get(hoverId) : undefined;

  const movePointerTip = (e: MouseEvent) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    setTipPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const moveFocusTip = (el: SVGPathElement) => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wrapRect = wrap.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    setTipPos({ x: elRect.left + elRect.width / 2 - wrapRect.left, y: elRect.top - wrapRect.top });
  };

  return (
    <div className="korea-map-wrap" ref={wrapRef}>
      <svg
        viewBox={`0 0 ${koreaMap.width} ${koreaMap.height}`}
        className="korea-map"
        role="group"
        aria-label="시·도경찰청 관할 지도"
        onMouseLeave={() => { setHoverId(null); setTipPos(null); }}
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
              aria-label={rg ? `${rg.name}, 등록 경찰서 ${rg.station_count}곳` : undefined}
              onMouseEnter={(e) => { if (rg) { setHoverId(f.id); movePointerTip(e); } }}
              onMouseMove={(e) => { if (rg) movePointerTip(e); }}
              onFocus={(e) => { if (rg) { setHoverId(f.id); moveFocusTip(e.currentTarget); } }}
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
        {koreaMap.features.map((f) => {
          const rg = regionMap.get(f.id);
          if (!rg) return null;
          const active = hoverId === f.id;
          return (
            <text
              key={`label-${f.id}`}
              x={f.cx}
              y={f.cy}
              className={`kr-label${active ? ' active' : ''}`}
              textAnchor="middle"
              dominantBaseline="middle"
              pointerEvents="none"
            >
              {rg.name}
            </text>
          );
        })}
      </svg>

      {hovered && tipPos && (
        <div className="korea-map-floating-tip" style={{ left: tipPos.x, top: tipPos.y }} aria-hidden="true">
          <b>{hovered.name}</b><span className="sub"> · {hovered.station_count}개 관서</span>
        </div>
      )}

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
