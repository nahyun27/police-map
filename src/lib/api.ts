/**
 * 백엔드(FastAPI) 클라이언트. 서버 컴포넌트·클라이언트 컴포넌트 양쪽에서 쓴다.
 * 타입은 backend/app/schemas/public.py, review.py 의 Pydantic 스키마와 1:1로 맞춘다.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8001';

export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, body: unknown) {
    super(`API error ${status}`);
    this.status = status;
    this.body = body;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
      cache: 'no-store',
    });
  } catch {
    throw new ApiError(0, null); // 네트워크 오류(서버 다운 등) — status 0 으로 구분
  }
  if (!res.ok) {
    let body: unknown = null;
    try { body = await res.json(); } catch { /* 본문이 JSON 이 아닐 수 있음 */ }
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface RatingSummary {
  fair: number | null;
  proc: number | null;
  att: number | null;
  comm: number | null;
  speed: number | null;
  overall: number | null;
  count: number;
}

export interface RegionOut {
  id: string;
  name: string;
  full_name: string;
  station_total: number;
  station_count: number;
  hq_address: string | null;
  hq_website: string | null;
}

export interface StationItem {
  id: number;
  name: string;
  address: string | null;
  website: string | null;
  department_count: number;
  rating: RatingSummary;
}

export interface RegionDetail extends RegionOut {
  stations: StationItem[];
}

export interface RegionRef {
  id: string;
  name: string;
  full_name: string;
}

export interface ReviewPublic {
  id: number;
  role: string;
  role_label: string;
  case_type: string;
  case_type_label: string;
  ratings: Record<string, number | null>;
  overall: number | null;
  body: string;
  published_at: string | null;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export interface StationDetail {
  id: number;
  name: string;
  address: string | null;
  website: string | null;
  source: string | null;
  region: RegionRef;
  departments: string[];
  rating: RatingSummary;
  reviews: Page<ReviewPublic>;
}

export interface RecentReview extends ReviewPublic {
  station_id: number;
  station_name: string;
}

export interface SearchResult {
  query: string;
  stations: StationItem[];
}

export interface Totals {
  stations: number;
  departments: number;
  reviews: number;
}

export interface YearValue {
  year: number;
  value: number;
}

export interface RankedStation {
  id: number;
  name: string;
  rating: number | null;
  review_count: number;
}

export interface StatsOverview {
  totals: Totals;
  national: RatingSummary;
  appeals_filed: YearValue[];
  appeal_acceptance_rate: YearValue | null;
  station_ranking: RankedStation[];
}

export const getRegions = () => apiFetch<RegionOut[]>('/regions');
export const getRegion = (id: string) => apiFetch<RegionDetail>(`/regions/${encodeURIComponent(id)}`);

export function getStation(id: number | string, opts?: { page?: number; size?: number }) {
  const qs = new URLSearchParams();
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.size) qs.set('size', String(opts.size));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiFetch<StationDetail>(`/stations/${encodeURIComponent(String(id))}${suffix}`);
}

export const getRecentReviews = (limit = 3) => apiFetch<RecentReview[]>(`/reviews/recent?limit=${limit}`);
export const search = (q: string) => apiFetch<SearchResult>(`/search?q=${encodeURIComponent(q)}`);
export const getStats = () => apiFetch<StatsOverview>('/stats/overview');

export interface ReviewRatingsIn {
  fair?: number | null;
  proc?: number | null;
  att?: number | null;
  comm?: number | null;
  speed?: number | null;
}

export interface ReviewCreatePayload {
  station_id: number;
  role: string;
  case_type: string;
  case_number?: string | null;
  ratings: ReviewRatingsIn;
  body?: string;
}

export interface ReviewReceipt {
  id: number;
  status: string;
  message: string;
}

export const submitReview = (payload: ReviewCreatePayload) =>
  apiFetch<ReviewReceipt>('/reviews', { method: 'POST', body: JSON.stringify(payload) });

export interface TakedownCreatePayload {
  target_type: 'review' | 'officer';
  target_id: number;
  request_type: 'delete' | 'correct';
  requester_name: string;
  requester_contact: string;
  relation: '본인' | '대리인' | '기타';
  reason: string;
}

export interface TakedownReceipt {
  public_code: string;
  status: string;
  due_at: string;
  message: string;
}

export const submitTakedown = (payload: TakedownCreatePayload) =>
  apiFetch<TakedownReceipt>('/takedown-requests', { method: 'POST', body: JSON.stringify(payload) });
