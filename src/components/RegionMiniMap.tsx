'use client';

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
  const feature = koreaMap.features.find((f) => f.id === regionId);
  const pins = (stationPinsData.pins as { id: number; region: string; x: number; y: number }[]).filter(
    (p) => p.region === regionId,
  );
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

  return (
    <Card>
      <h2>경찰서 위치</h2>
      <p className="sub">핀을 클릭하면 해당 경찰서 상세 페이지로 이동합니다.</p>
      <div className="region-mini-map-wrap">
        <svg viewBox={viewBox} className="region-mini-map" role="img" aria-label={`${regionId} 관할 경찰서 위치`}>
          <path d={feature.d} className="region-mini-shape" />
          {pins.map((p) => {
            const st = stationMap.get(p.id);
            if (!st) return null;
            const overall = st.rating.overall;
            const tone = overall === null ? 'none' : overall >= 3.8 ? 'good' : overall >= 3.2 ? 'mid' : 'low';
            return (
              <RegionPin
                key={p.id} x={p.x} y={p.y} r={pinR} name={st.name} tone={tone} stationId={p.id}
                labelFontSize={labelFontSize}
              />
            );
          })}
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

function RegionPin({
  x, y, r, name, tone, stationId, labelFontSize,
}: { x: number; y: number; r: number; name: string; tone: string; stationId: number; labelFontSize: number }) {
  const router = useRouter();

  // 브라우저 기본 title 툴팁(딜레이 길고 각지고 못생김) 대신 핀 위에 뜨는 말풍선 라벨을
  // 직접 그린다. getBBox로 실측하지 않고 글자 수로 폭을 어림하는 이유는 이 컴포넌트가
  // 서버에서도 렌더되는 Region 상세 페이지 하위라 마운트 시점에 측정 깜빡임을 피하고
  // 싶어서 — 경찰서 이름은 한글 완성형뿐이라 글자당 너비가 거의 균일해 어림해도 충분하다.
  const padX = labelFontSize * 0.62;
  const labelW = name.length * labelFontSize * 1.04 + padX * 2;
  const labelH = labelFontSize * 2.15;
  const gap = r * 0.55 + labelFontSize * 0.3;
  const labelBottom = -r * 1.6 - gap;
  const labelTop = labelBottom - labelH;
  const arrowW = labelFontSize * 0.68;

  return (
    <g
      className={`region-pin tone-${tone}`}
      transform={`translate(${x} ${y})`}
      tabIndex={0}
      role="button"
      aria-label={`${name} 상세 보기`}
      onClick={() => router.push(`/station/${stationId}`)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          router.push(`/station/${stationId}`);
        }
      }}
    >
      <path d={shieldPath(r)} strokeWidth={r * 0.3} strokeLinejoin="round" className="pin-shield" />
      <g className="pin-label">
        <path
          d={`M${-arrowW},${labelBottom} L${arrowW},${labelBottom} L0,${labelBottom + gap * 0.9} Z`}
          className="pin-label-arrow"
        />
        <rect
          x={-labelW / 2} y={labelTop} width={labelW} height={labelH} rx={labelH / 2}
          className="pin-label-bg"
        />
        <text x={0} y={(labelTop + labelBottom) / 2} fontSize={labelFontSize} className="pin-label-text">
          {name}
        </text>
      </g>
    </g>
  );
}
