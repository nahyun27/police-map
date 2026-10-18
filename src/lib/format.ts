/** "2026-07-15T00:00:00+00:00" → "2026.07.15" */
export function formatDate(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10).replaceAll('-', '.');
}

/** 로그인 후 돌아갈 주소(?next=)를 같은 사이트 내부 경로로만 제한한다(외부 사이트로 보내는 오픈 리다이렉트 방지). */
export function safeNext(next: string | null, fallback: string): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  return next;
}
