/** "2026-07-15T00:00:00+00:00" → "2026.07.15" */
export function formatDate(iso: string | null): string {
  if (!iso) return '';
  return iso.slice(0, 10).replaceAll('-', '.');
}
