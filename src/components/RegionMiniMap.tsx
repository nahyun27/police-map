'use client';

import { useEffect, useRef, useState } from 'react';
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
 * (src/data/stationPins.json). 좌표가 없는 관서는 핀 없이 생략된다.
 * 핀은 DB id 가 아니라 `관서명:region_id` 로 키를 잡는다. 로컬 개발 DB와 운영 DB는 시딩 순서가
 * 달라 같은 관서라도 id 가 다르게 배정돼 있어서, id 로 맞추면 운영에서 핀이 엉뚱한 관서에 붙는다
 * (stationJurisdiction.json 과 같은 이유, scripts/build_station_jurisdiction.py 주석 참고).
 * 이동할 상세 페이지 id 는 API 가 준 관서 목록의 id 를 쓴다. */
export default function RegionMiniMap({ regionId, stations }: RegionMiniMapProps) {
  const router = useRouter();
  const feature = koreaMap.features.find((f) => f.id === regionId);
  const pins = (stationPinsData.pins as { key: string; region: string; x: number; y: number }[]).filter(
    (p) => p.region === regionId,
  );
  const [hoverId, setHoverId] = useState<number | null>(null);
  // 터치 화면엔 호버가 없어서 핀을 누르면 이름을 못 본 채 바로 이동해 버린다 — 터치일 땐 첫 탭은
  // 이름만 보여주고, 같은 핀을 한 번 더 누르면 이동한다(마우스·키보드는 기존처럼 바로 이동).
  const lastPointer = useRef<string>('mouse');
  // 지도가 화면에 실제로 그려진 폭(px). 핀·이름표를 화면 기준 고정 크기로 맞추는 데 쓴다 — 지도를 크게
  // 그릴수록 같은 크기의 이름표가 들어갈 자리가 늘어나 더 많은 이름을 겹치지 않게 보여줄 수 있다.
  const svgRef = useRef<SVGSVGElement>(null);
  const [renderW, setRenderW] = useState(560);
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => { if (e.contentRect.width) setRenderW(e.contentRect.width); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  if (!feature || !pins.length) return null;

  const stationMap = new Map(stations.map((s) => [`${s.name}:${regionId}`, s]));
  const [x0, y0, x1, y1] = feature.bbox;
  const padX = Math.max((x1 - x0) * 0.18, 12);
  const padY = Math.max((y1 - y0) * 0.18, 12);
  const vbWidth = x1 - x0 + padX * 2;
  const viewBox = `${x0 - padX} ${y0 - padY} ${vbWidth} ${y1 - y0 + padY * 2}`;
  // viewBox 단위 ↔ 화면 px 환산. 핀 반지름 5px, 이름 글자 11px 가 어느 지역·어느 화면 폭에서도
  // 같은 크기로 찍히도록 실제 렌더 폭(renderW) 기준으로 viewBox 단위를 역산한다.
  const unit = vbWidth / renderW;
  const pinR = 5 * unit;
  const labelFontSize = 11 * unit;

  const visible = pins
    .map((p) => {
      const st = stationMap.get(p.key);
      if (!st) return null;
      const overall = st.rating.overall;
      const tone = overall === null ? 'none' : overall >= 3.8 ? 'good' : overall >= 3.2 ? 'mid' : 'low';
      return { id: st.id, x: p.x, y: p.y, name: st.name, tone };
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);

  const goTo = (stationId: number) => router.push(`/station/${stationId}`);
  const onPinClick = (stationId: number) => {
    if (lastPointer.current === 'touch' && hoverId !== stationId) { setHoverId(stationId); return; }
    goTo(stationId);
  };

  // 경찰서가 몰린 지역(경기남부·대구 등)에서 이름을 전부 띄우면 서로 겹쳐 하나도 안 읽힌다.
  // 그래서 이름표 자리를 어림해서, 이미 놓인 이름표나 다른 핀과 겹치는 이름은 숨기고 핀만 둔다
  // (숨긴 이름은 핀에 마우스를 올리거나 탭하면 말풍선으로 보인다). 위쪽 핀부터 차례로 놓는다.
  const textY = -pinR * 1.6 - labelFontSize * 0.55; // PinLabel 의 글자 기준선과 같은 값
  const margin = labelFontSize * 0.25;
  const pinBoxes = visible.map((p) => [p.x - pinR, p.y - pinR * 1.2, p.x + pinR, p.y + pinR * 1.2]);
  const placed: number[][] = [];
  const shownLabels = new Set<number>();
  for (const p of [...visible].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const w = p.name.length * labelFontSize * 1.0;
    const box = [p.x - w / 2 - margin, p.y + textY - labelFontSize - margin, p.x + w / 2 + margin, p.y + textY + labelFontSize * 0.3 + margin];
    const hits = (o: number[]) => box[0] < o[2] && box[2] > o[0] && box[1] < o[3] && box[3] > o[1];
    const ownPin = (o: number[]) => o[0] === p.x - pinR && o[1] === p.y - pinR * 1.2;
    if (placed.some(hits) || pinBoxes.some((o) => !ownPin(o) && hits(o))) continue;
    placed.push(box);
    shownLabels.add(p.id);
  }
  const hiddenCount = visible.length - shownLabels.size;
  const active = visible.find((p) => p.id === hoverId);

  return (
    <Card>
      <h2>경찰서 위치</h2>
      <p className="sub">
        핀을 클릭하면 해당 경찰서 상세 페이지로 이동합니다.
        {hiddenCount > 0 && ' 이름이 겹치는 곳은 핀에 마우스를 올리면(모바일은 한 번 탭) 이름이 보여요.'}
      </p>
      <div className="region-mini-map-wrap">
        <svg ref={svgRef} viewBox={viewBox} className="region-mini-map" role="img" aria-label={`${regionId} 관할 경찰서 위치`}>
          <path d={feature.d} className="region-mini-shape" />
          {visible.map((p) => (
            <g
              key={p.id}
              className={`region-pin tone-${p.tone}`}
              transform={`translate(${p.x} ${p.y})`}
              tabIndex={0}
              role="button"
              aria-label={`${p.name} 상세 보기`}
              onPointerDown={(e) => { lastPointer.current = e.pointerType; }}
              onClick={() => onPinClick(p.id)}
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
          {visible.filter((p) => shownLabels.has(p.id) && p.id !== hoverId).map((p) => (
            <PinLabel
              key={p.id} x={p.x} y={p.y} r={pinR} name={p.name} fontSize={labelFontSize}
              active={false} dimmed={hoverId !== null}
            />
          ))}
          {/* 활성(호버·포커스·탭) 이름표는 숨겨졌던 것이어도 말풍선으로 띄우고, 항상 맨 마지막에
              그려서 다른 이름표 위에 오게 한다(SVG 는 나중에 그린 게 위로 온다). */}
          {active && (
            <PinLabel
              key={`active-${active.id}`} x={active.x} y={active.y} r={pinR} name={active.name} fontSize={labelFontSize}
              active dimmed={false}
            />
          )}
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
