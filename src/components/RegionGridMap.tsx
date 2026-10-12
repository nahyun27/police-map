'use client';

import Link from 'next/link';
import { REGION_GRID } from '@/data/regionGrid';
import type { RegionOut } from '@/lib/api';

interface RegionGridMapProps {
  regions: RegionOut[];
}

// 진한 남색(--brand-ink)을 흰 배경 위에 알파값만큼 섞은 칸 배경색 위에 흰 글씨를 올릴지
// 먹색(--ink) 글씨를 올릴지를 "진하길래 대충 반 넘으면 흰 글씨" 식으로 임계값을 매기면
// 연한~중간 톤 구간에서 대비가 부족해진다 — 실제 섞인 색의 상대휘도를 계산해 흰 글씨·먹
// 글씨 중 대비가 더 큰 쪽을 그때그때 고른다.
const OVERLAY_RGB: [number, number, number] = [26, 63, 191]; // --brand-ink
function relLuminance([r, g, b]: [number, number, number]): number {
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function pickDeep(alpha: number): boolean {
  const mixed: [number, number, number] = [0, 1, 2].map(
    (i) => OVERLAY_RGB[i] * alpha + 255 * (1 - alpha),
  ) as [number, number, number];
  const l = relLuminance(mixed);
  const contrastWithWhite = 1.05 / (l + 0.05);
  const contrastWithInk = (l + 0.05) / 0.05; // --ink(#0b1220)는 거의 검정이라 0으로 근사
  return contrastWithWhite >= contrastWithInk;
}

/** 실제 지도(KoreaMap) 대신 쓸 수 있는 "간소화" 보기. 칸 크기를 다 똑같이 맞춘 타일 격자라
 * 서울처럼 면적이 작은 지역도 다른 지역만큼 큼직하게 눌러서 고를 수 있다(지도 모드는 정확한
 * 위치 감각, 이 모드는 터치하기 쉬운 큼직한 타일 — 취향에 따라 토글, RegionMapSwitcher 참고). */
export default function RegionGridMap({ regions }: RegionGridMapProps) {
  const regionMap = new Map(regions.map((r) => [r.id, r]));
  const max = Math.max(1, ...regions.map((r) => r.station_count));
  const cols = Math.max(...REGION_GRID.map((c) => c.col));
  const rows = Math.max(...REGION_GRID.map((c) => c.row));

  return (
    <div
      className="region-grid-map"
      style={{ gridTemplateColumns: `repeat(${cols}, 1fr)`, gridTemplateRows: `repeat(${rows}, 1fr)` }}
    >
      {REGION_GRID.map((cell) => {
        const rg = regionMap.get(cell.id);
        if (!rg) return null;
        const t = rg.station_count / max;
        const alpha = 0.12 + t * 0.8;
        const [r, g, b] = OVERLAY_RGB;
        const bg = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
        return (
          <Link
            key={cell.id}
            href={`/region/${cell.id}`}
            className={`region-grid-cell${pickDeep(alpha) ? ' deep' : ''}`}
            style={{ gridColumn: cell.col, gridRow: cell.row, background: bg }}
          >
            <b>{rg.name}</b>
            <span>{rg.station_count}개 관서</span>
          </Link>
        );
      })}
    </div>
  );
}
