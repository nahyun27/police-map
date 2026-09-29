/** 홈 화면 지도 타일 배치(5열 그리드, null=빈칸). 지역 id 는 backend/scripts/import_stations.py 의
 * REGION_SLUG 과 반드시 같아야 한다. */
export const TILE: (string | null)[] = [
  null, null, 'ggn', 'gangwon', null,
  null, 'seoul', 'ggs', null, null,
  'incheon', 'sejong', 'chungbuk', 'gyeongbuk', null,
  null, 'chungnam', 'daejeon', 'daegu', 'ulsan',
  'jeonbuk', 'gwangju', 'gyeongnam', 'busan', null,
  'jeonnam', null, null, null, null,
  'jeju', null, null, null, null,
];
