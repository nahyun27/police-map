/** "간소화" 보기(src/components/RegionGridMap.tsx)에서 쓰는 타일 격자 좌표. 실제 위경도가
 * 아니라 신문·방송에서 흔히 쓰는 카토그램(cartogram) 방식 — 칸 크기를 다 동일하게 맞추는
 * 대신 "서울이 북서, 부산이 남동" 같은 대략적인 상대 위치만 유지한다. koreaMap.json 의
 * 18개 지역 id와 정확히 1:1로 맞아야 한다(경기는 남/북부로 분리돼 있어 칸이 두 개).
 */
export interface RegionGridCell {
  id: string;
  col: number;
  row: number;
}

export const REGION_GRID: RegionGridCell[] = [
  { id: 'gangwon', col: 3, row: 1 },
  { id: 'incheon', col: 1, row: 2 },
  { id: 'ggn', col: 2, row: 2 },
  { id: 'seoul', col: 3, row: 2 },
  { id: 'gyeongbuk', col: 4, row: 2 },
  { id: 'ggs', col: 2, row: 3 },
  { id: 'chungbuk', col: 3, row: 3 },
  { id: 'daegu', col: 4, row: 3 },
  { id: 'chungnam', col: 1, row: 4 },
  { id: 'daejeon', col: 2, row: 4 },
  { id: 'sejong', col: 3, row: 4 },
  { id: 'jeonbuk', col: 1, row: 5 },
  { id: 'gyeongnam', col: 3, row: 5 },
  { id: 'ulsan', col: 4, row: 5 },
  { id: 'gwangju', col: 1, row: 6 },
  { id: 'jeonnam', col: 2, row: 6 },
  { id: 'busan', col: 4, row: 6 },
  { id: 'jeju', col: 2, row: 7 },
];
