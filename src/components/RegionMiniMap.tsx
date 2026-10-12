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

/** 경찰서 좌표는 backend/scripts/geocode_stations.py 로 지오코딩한 값을 투영한 정적 데이터다
 * (src/data/stationPins.json). 좌표가 없는 관서는 핀 없이 생략된다. */
export default function RegionMiniMap({ regionId, stations }: RegionMiniMapProps) {
  const router = useRouter();
  const feature = koreaMap.features.find((f) => f.id === regionId);
  const pins = (stationPinsData.pins as { id: number; region: string; x: number; y: number }[]).filter(
    (p) => p.region === regionId,
  );
  const [hoverId, setHoverId] = useState<number | null>(null);
  if (!feature || !pins.length) return null;

  const stationMap = new Map(stations.map((s) => [s.id, s]));
  const [x0, y0, x1, y1] = feature.bbox;
  const padX = Math.max((x1 - x0) * 0.18, 12);
  const padY = Math.max((y1 - y0) * 0.18, 12);
  const vbWidth = x1 - x0 + padX * 2;
  const viewBox = `${x0 - padX} ${y0 - padY} ${vbWidth} ${y1 - y0 + padY * 2}`;
  // 화면에 찍히는 실제 지도 폭(.region-mini-map의 max-width)은 모든 지역이 동일하므로,
  // 핀 반지름을 이 지역의 viewBox 폭에 비례시켜야 서울처럼 좁게 확대된 지역에서도
  // 핀끼리 서로 뭉개지지 않고 화면상 크기가 일정하게 유지된다.
  const pinR = Math.min(5, Math.max(1.1, vbWidth * 0.012));
  // 라벨 글자 크기도 핀 반지름과 같은 방식(viewBox 폭 비례)으로 잡아야 지역마다 화면에
  // 찍히는 실제 글자 크기가 똑같이 유지된다(위 pinR 주석 참고).
  const labelFontSize = Math.min(9, Math.max(3.4, vbWidth * 0.024));

  const visible = pins
    .map((p) => {
      const st = stationMap.get(p.id);
      if (!st) return null;
      const overall = st.rating.overall;
      const tone = overall === null ? 'none' : overall >= 3.8 ? 'good' : overall >= 3.2 ? 'mid' : 'low';
      return { ...p, name: st.name, tone };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const goTo = (stationId: number) => router.push(`/station/${stationId}`);

  // 라벨은 핀(방패)과 별도 레이어로, 나중에 그려서 항상 지도 위에 뜨게 한다. 호버 중인
  // 라벨이 다른 라벨에 가려지지 않도록 배열 맨 뒤로 보내 SVG 그리기 순서상 맨 위에 오게 한다
  // (KoreaMap.tsx 의 지역명 라벨도 같은 이유로 지역 도형과 별도 pass 로 그린다).
  const labelOrder = [...visible].sort((a, b) => (a.id === hoverId ? 1 : b.id === hoverId ? -1 : 0));

  return (
    <Card>
      <h2>경찰서 위치</h2>
      <p className="sub">핀을 클릭하면 해당 경찰서 상세 페이지로 이동합니다.</p>
      <div className="region-mini-map-wrap">
        <svg viewBox={viewBox} className="region-mini-map" role="img" aria-label={`${regionId} 관할 경찰서 위치`}>
          <path d={feature.d} className="region-mini-shape" />
          {visible.map((p) => (
            <g
              key={p.id}
              className={`region-pin tone-${p.tone}`}
              transform={`translate(${p.x} ${p.y})`}
              tabIndex={0}
              role="button"
              aria-label={`${p.name} 상세 보기`}
              onClick={() => goTo(p.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo(p.id); }
              }}
              onMouseEnter={() => setHoverId(p.id)}
              onMouseLeave={() => setHoverId((cur) => (cur === p.id ? null : cur))}
              onFocus={() => setHoverId(p.id)}
              onBlur={() => setHoverId((cur) => (cur === p.id ? null : cur))}
            >
              <path d={shieldPath(pinR)} strokeWidth={pinR * 0.3} strokeLinejoin="round" className="pin-shield" />
            </g>
          ))}
          {labelOrder.map((p) => (
            <PinLabel
              key={p.id} x={p.x} y={p.y} r={pinR} name={p.name} fontSize={labelFontSize}
              active={p.id === hoverId} dimmed={hoverId !== null && p.id !== hoverId}
            />
          ))}
        </svg>
      </div>
    </Card>
  );
}

/** 동그라미 핀 대신 쓰는 경찰서 모양(방패) 실루엣. 지도 핀은 반지름이 1~5 단위로 아주 작아서
 * (region-mini-map-wrap, 위 주석 참고) 별 같은 속 디테일은 그 크기에서 뭉개지므로 넣지 않고
 * 윤곽만 그린다(별이 들어간 전체 버전은 components/icons/PoliceStationIcon.tsx 참고, 검색
 * 결과처럼 충분히 큰 자리에서 쓴다). */
function shieldPath(r: number): string {
  const w = r, h = r * 1.15;
  const pts: [number, number][] = [
    [-w * 0.78, -h * 0.87], [w * 0.78, -h * 0.87], [w, -h * 0.43],
    [w, h * 0.09], [0, h], [-w, h * 0.09], [-w, -h * 0.43],
  ];
  return `M${pts.map(([px, py]) => `${px},${py}`).join(' L')} Z`;
}

/**
 * 경찰서 이름 라벨. 평소엔 글자만 회색으로 늘 떠 있다가(지역에 관서가 많아도 지도가
 * 글자 뭉치로 덮이지 않도록 — 서울처럼 34곳이 몰린 지역에서 말풍선을 전부 띄워보면
 * 서로 겹쳐 뭉개진다), 호버·포커스한 핀만 검정 말풍선(배경+화살표)으로 커지며 도드라진다.
 */
function PinLabel({
  x, y, r, name, fontSize, active, dimmed,
}: { x: number; y: number; r: number; name: string; fontSize: number; active: boolean; dimmed: boolean }) {
  // getBBox로 실측하지 않고 글자 수로 폭을 어림하는 이유는 이 컴포넌트가 서버에서도
  // 렌더되는 Region 상세 페이지 하위라 마운트 시점에 측정 깜빡임을 피하고 싶어서 —
  // 경찰서 이름은 한글 완성형뿐이라 글자당 너비가 거의 균일해 어림해도 충분하다.
  const padX = fontSize * 0.62;
  const labelW = name.length * fontSize * 1.04 + padX * 2;
  const labelH = fontSize * 2.15;
  const gap = r * 0.55 + fontSize * 0.3;
  const labelBottom = -r * 1.6 - gap;
  const labelTop = labelBottom - labelH;
  const arrowW = fontSize * 0.68;
  const textY = -r * 1.6 - fontSize * 0.55; // 말풍선 없이 텍스트만 뜰 때 핀 바로 위 기준선

  return (
    <g
      className={`pin-label${active ? ' active' : ''}${dimmed ? ' dimmed' : ''}`}
      transform={`translate(${x} ${y})`}
      aria-hidden="true"
    >
      <path
        d={`M${-arrowW},${labelBottom} L${arrowW},${labelBottom} L0,${labelBottom + gap * 0.9} Z`}
        className="pin-label-arrow"
      />
      <rect
        x={-labelW / 2} y={labelTop} width={labelW} height={labelH} rx={labelH / 2}
        className="pin-label-bg"
      />
      <text
        x={0} y={active ? (labelTop + labelBottom) / 2 : textY} fontSize={fontSize}
        className="pin-label-text"
      >
        {name}
      </text>
    </g>
  );
}
