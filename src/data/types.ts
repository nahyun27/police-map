/** 권리구제 내비게이터용 정적 콘텐츠 타입. 경찰서·평가 데이터는 src/lib/api.ts (백엔드 API)를 쓴다. */
export interface Remedy {
  id: string;
  q: string;
  ch: string;
  to: string;
  base: string;
  how: string;
  tip: string;
}
