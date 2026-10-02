'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import koreaMap from '@/data/koreaMap.json';
import stationPinsData from '@/data/stationPins.json';
import { Card } from '@/components/ui';
import type { StationItem } from '@/lib/api';

interface RegionMiniMapProps {
  regionId: string;
  stations: Pick<StationItem, 'id' | 'name' | 'rating'>[];
}

const ZOOM_MS = 260;

/** 경찰서 좌표는 backend/scripts/geocode_stations.py 로 지오코딩한 값을 투영한 정적 데이터다
 * (src/data/stationPins.json). 좌표가 없는 관서는 핀 없이 생략된다. */
export default function RegionMiniMap({ regionId, stations }: RegionMiniMapProps) {
  const router = useRouter();
  const [zoom, setZoom] = useState<{ stationId: number; xPct: number; yPct: number } | null>(null);
  const feature = koreaMap.features.find((f) => f.id === regionId);
  const pins = (stationPinsData.pins as { id: number; region: string; x: number; y: number }[]).filter(
    (p) => p.region === regionId,
  );
  if (!feature || !pins.length) return null;

  const stationMap = new Map(stations.map((s) => [s.id, s]));
  const [x0, y0, x1, y1] = feature.bbox;
  const padX = Math.max((x1 - x0) * 0.18, 12);
  const padY = Math.max((y1 - y0) * 0.18, 12);
  const vbX = x0 - padX;
  const vbY = y0 - padY;
  const vbWidth = x1 - x0 + padX * 2;
  const vbHeight = y1 - y0 + padY * 2;
  // 화면에 찍히는 실제 지도 폭(.region-mini-map의 max-width)은 모든 지역이 동일하므로,
  // 핀 반지름을 이 지역의 viewBox 폭에 비례시켜야 서울처럼 좁게 확대된 지역에서도
  // 핀끼리 서로 뭉개지지 않고 화면상 크기가 일정하게 유지된다.
  const pinR = Math.min(5, Math.max(1.1, vbWidth * 0.012));

  const activate = (stationId: number, px: number, py: number) => {
    if (zoom) return; // 전환 애니메이션 중 중복 클릭 방지
    const xPct = ((px - vbX) / vbWidth) * 100;
    const yPct = ((py - vbY) / vbHeight) * 100;
    setZoom({ stationId, xPct, yPct });
    router.prefetch(`/station/${stationId}`);
    setTimeout(() => router.push(`/station/${stationId}`), ZOOM_MS);
  };

  return (
    <Card>
      <h2>경찰서 위치</h2>
      <p className="sub">핀을 클릭하면 해당 경찰서 상세 페이지로 이동합니다.</p>
      <div className="region-mini-map-wrap">
        <svg
          viewBox={`${vbX} ${vbY} ${vbWidth} ${vbHeight}`}
          className={`region-mini-map${zoom ? ' zooming' : ''}`}
          style={zoom ? { transformOrigin: `${zoom.xPct}% ${zoom.yPct}%` } : undefined}
          role="img"
          aria-label={`${regionId} 관할 경찰서 위치`}
        >
          <path d={feature.d} className="region-mini-shape" />
          {pins.map((p) => {
            const st = stationMap.get(p.id);
            if (!st) return null;
            const overall = st.rating.overall;
            const tone = overall === null ? 'none' : overall >= 3.8 ? 'good' : overall >= 3.2 ? 'mid' : 'low';
            return (
              <RegionPin
                key={p.id}
                x={p.x}
                y={p.y}
                r={pinR}
                name={st.name}
                tone={tone}
                fadeOut={!!zoom && zoom.stationId !== p.id}
                onActivate={() => activate(p.id, p.x, p.y)}
              />
            );
          })}
        </svg>
      </div>
    </Card>
  );
}

function RegionPin({
  x, y, r, name, tone, fadeOut, onActivate,
}: { x: number; y: number; r: number; name: string; tone: string; fadeOut: boolean; onActivate: () => void }) {
  return (
    <g
      className={`region-pin tone-${tone}${fadeOut ? ' fade-out' : ''}`}
      transform={`translate(${x} ${y})`}
      tabIndex={0}
      role="button"
      aria-label={`${name} 상세 보기`}
      onClick={onActivate}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onActivate();
        }
      }}
    >
      <title>{name}</title>
      <circle r={r} strokeWidth={r * 0.3} className="pin-dot" />
    </g>
  );
}
