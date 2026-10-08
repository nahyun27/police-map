'use client';

import { useRouter } from 'next/navigation';
import type { RegionOut } from '@/lib/api';

/**
 * 게시판 지역 필터. 지역이 17개라 전부 버튼으로 늘어놓으니 지저분해 보인다는 피드백으로
 * 셀렉트박스로 바꿨다. 나머지 필터(글머리·정렬·검색어)는 그대로 Link 기반 서버 렌더링
 * 필터라, 이 드롭다운만 클라이언트 컴포넌트로 분리해 값이 바뀌면 그 필터들을 그대로 유지한
 * 채 region 쿼리만 바꿔서 이동한다.
 */
export function RegionFilterSelect({
  regions, value, category, sort, period, q,
}: {
  regions: RegionOut[]; value: string; category?: string; sort: string; period: string; q?: string;
}) {
  const router = useRouter();

  const onChange = (regionId: string) => {
    const p = new URLSearchParams();
    if (regionId) p.set('region', regionId);
    if (category) p.set('category', category);
    if (sort !== 'new') p.set('sort', sort);
    if (sort === 'top' && period !== 'all') p.set('period', period);
    if (q) p.set('q', q);
    const s = p.toString();
    router.push(`/board${s ? `?${s}` : ''}`);
  };

  return (
    <select className="sel" value={value} onChange={(e) => onChange(e.target.value)} aria-label="지역 선택">
      <option value="">전체 지역</option>
      {regions.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
    </select>
  );
}
