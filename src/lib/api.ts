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

interface ApiFetchInit extends RequestInit {
  /** 이 값을 주면 Next 의 Data Cache 에 N초간 캐시한다(프로덕션 빌드에서만 효과가 있음 —
   * `next dev` 는 매번 새로 렌더링하고 절대 캐시하지 않는 게 Next.js 자체의 설계). 생략하면
   * 기존처럼 항상 최신 데이터를 가져온다(no-store). 로그인 세션이 섞이는 관리자·쿠키 기반
   * 요청에는 쓰지 않는다 — Data Cache 는 요청자와 무관하게 서버 전체에서 공유된다. */
  revalidateSeconds?: number;
}

async function apiFetch<T>(path: string, init?: ApiFetchInit): Promise<T> {
  const { revalidateSeconds, ...rest } = init ?? {};
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1${path}`, {
      ...rest,
      headers: { 'Content-Type': 'application/json', ...(rest.headers ?? {}) },
      ...(revalidateSeconds !== undefined ? { next: { revalidate: revalidateSeconds } } : { cache: 'no-store' }),
      // 관리자 세션 쿠키를 함께 보낸다. 공개 API 는 쿠키를 보지 않으므로 무해하다.
      // (서버 컴포넌트의 Node fetch 에는 브라우저 쿠키 저장소가 없어 이 옵션이 영향을 주지 않는다.)
      credentials: 'include',
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
  lat: number | null;
  lng: number | null;
}

export interface RegionDetail extends RegionOut {
  stations: StationItem[];
}

export interface RegionRef {
  id: string;
  name: string;
  full_name: string;
}

export interface ReplyOut {
  id: number;
  review_id: number;
  author_label: string;
  show_name: boolean;
  is_mine: boolean;
  body: string;
  created_at: string | null;
  updated_at: string | null;
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
  comment_count: number;
  score: number;
  my_vote: number;
  evidence_verified: boolean;
  reply: ReplyOut | null;
  is_scrapped: boolean;
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
  lat: number | null;
  lng: number | null;
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

// 공개·비로그인 조회는 짧게 캐시해서(프로덕션 빌드에서) 반복 방문·탭 전환이 즉시 뜨게 한다.
// 평가 승인·삭제정정 처리 등은 최대 30초 정도 늦게 반영될 수 있다 — 이 사이트 성격상 허용 가능한 지연.
export const getRegions = () => apiFetch<RegionOut[]>('/regions', { revalidateSeconds: 30 });
export const getRegion = (id: string) => apiFetch<RegionDetail>(`/regions/${encodeURIComponent(id)}`, { revalidateSeconds: 30 });

export function getStation(id: number | string, opts?: { page?: number; size?: number }) {
  const qs = new URLSearchParams();
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.size) qs.set('size', String(opts.size));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiFetch<StationDetail>(`/stations/${encodeURIComponent(String(id))}${suffix}`, { revalidateSeconds: 30 });
}

export function getRecentReviews(limit = 3, regionIds?: string[]) {
  const qs = new URLSearchParams({ limit: String(limit) });
  if (regionIds?.length) qs.set('region', regionIds.join(','));
  return apiFetch<RecentReview[]>(`/reviews/recent?${qs}`, { revalidateSeconds: 30 });
}
export const search = (q: string) => apiFetch<SearchResult>(`/search?q=${encodeURIComponent(q)}`, { revalidateSeconds: 15 });
export const getStats = () => apiFetch<StatsOverview>('/stats/overview', { revalidateSeconds: 60 });

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
  evidence_note?: string | null;
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

export interface TakedownStatusOut {
  public_code: string;
  status: string;
  request_type: string;
  target_type: string;
  created_at: string;
  due_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
}

export const getTakedownStatus = (code: string) => apiFetch<TakedownStatusOut>(`/takedown-requests/${encodeURIComponent(code)}`);

/* ===================== 인증 (일반 회원 + 관리자 공용) ===================== */

export interface UserOut {
  id: number;
  email: string;
  nickname: string;
  role: 'user' | 'admin';
  identity_verified: boolean;
  officer_station_id: number | null;
  officer_station_name: string | null;
  officer_rank: string | null;
}

export const register = (email: string, password: string, nickname: string) =>
  apiFetch<UserOut>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, nickname }) });
export const login = (email: string, password: string) =>
  apiFetch<UserOut>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
export const logout = () => apiFetch<void>('/auth/logout', { method: 'POST' });
export const getMe = () => apiFetch<UserOut>('/auth/me');

export interface MyReviewOut {
  id: number;
  station_id: number;
  station_name: string;
  role: string;
  role_label: string;
  case_type: string;
  case_type_label: string;
  ratings: Record<string, number | null>;
  overall: number | null;
  body: string;
  status: 'pending' | 'published' | 'rejected' | 'blinded' | 'removed';
  reject_reason: string | null;
  created_at: string | null;
  published_at: string | null;
  comment_count: number;
  score: number;
  evidence_note: string | null;
  evidence_verified: boolean;
  reply: ReplyOut | null;
  is_scrapped: boolean;
}

export function getMyReviews(opts?: { page?: number; size?: number }) {
  const qs = new URLSearchParams();
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.size) qs.set('size', String(opts.size));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiFetch<Page<MyReviewOut>>(`/reviews/mine${suffix}`);
}

/* ===================== 경찰관 신원 인증 + 해명 ===================== */

export interface VerifyOut {
  id: number;
  station_id: number;
  station_name: string;
  name: string;
  rank: string;
  department: string | null;
  contact: string;
  proof_note: string | null;
  status: 'pending' | 'approved' | 'rejected';
  reject_reason: string | null;
  created_at: string | null;
}

export interface VerifyCreatePayload {
  station_id: number;
  name: string;
  rank: string;
  department?: string | null;
  contact: string;
  proof_note?: string | null;
}

export const getMyVerifications = () => apiFetch<VerifyOut[]>('/officer-verifications/mine');
export const createVerification = (payload: VerifyCreatePayload) =>
  apiFetch<VerifyOut>('/officer-verifications', { method: 'POST', body: JSON.stringify(payload) });

export const createReply = (reviewId: number, body: string, showName: boolean) =>
  apiFetch<ReplyOut>(`/reviews/${reviewId}/reply`, { method: 'POST', body: JSON.stringify({ body, show_name: showName }) });
export const updateReply = (reviewId: number, body: string, showName: boolean) =>
  apiFetch<ReplyOut>(`/reviews/${reviewId}/reply`, { method: 'PATCH', body: JSON.stringify({ body, show_name: showName }) });
export const deleteReply = (reviewId: number) => apiFetch<void>(`/reviews/${reviewId}/reply`, { method: 'DELETE' });

/* ===================== 관심 지역 ===================== */

export interface RegionFollowOut {
  region_id: string;
  region_name: string;
  region_full_name: string;
}

export const getMyRegions = () => apiFetch<RegionFollowOut[]>('/me/regions');
export const followRegion = (regionId: string) =>
  apiFetch<RegionFollowOut>(`/me/regions/${encodeURIComponent(regionId)}`, { method: 'POST' });
export const unfollowRegion = (regionId: string) =>
  apiFetch<void>(`/me/regions/${encodeURIComponent(regionId)}`, { method: 'DELETE' });

/* ===================== 추천/비추천 · 댓글 (평가 + 게시판 공용) ===================== */

export interface VoteSummary {
  up: number;
  down: number;
  score: number;
  my_vote: number;
}

export interface CommentOut {
  id: number;
  author_nickname: string;
  body: string;
  is_removed: boolean;
  is_mine: boolean;
  parent_id: number | null;
  created_at: string | null;
  replies: CommentOut[];
}

const vote = (path: string, value: 1 | -1 | 0) =>
  apiFetch<VoteSummary>(path, { method: 'POST', body: JSON.stringify({ value }) });

export interface ScrapStatus {
  scrapped: boolean;
}

export const voteReview = (reviewId: number, value: 1 | -1 | 0) => vote(`/reviews/${reviewId}/vote`, value);
export const getReviewComments = (reviewId: number) => apiFetch<CommentOut[]>(`/reviews/${reviewId}/comments`);
export const createReviewComment = (reviewId: number, body: string, parentId?: number) =>
  apiFetch<CommentOut>(`/reviews/${reviewId}/comments`, { method: 'POST', body: JSON.stringify({ body, parent_id: parentId ?? null }) });
export const deleteReviewComment = (commentId: number) => apiFetch<void>(`/reviews/comments/${commentId}`, { method: 'DELETE' });
export const scrapReview = (reviewId: number) => apiFetch<ScrapStatus>(`/reviews/${reviewId}/scrap`, { method: 'POST' });
export const unscrapReview = (reviewId: number) => apiFetch<ScrapStatus>(`/reviews/${reviewId}/scrap`, { method: 'DELETE' });
export function getMyReviewScraps(opts?: { page?: number; size?: number }) {
  const qs = new URLSearchParams();
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.size) qs.set('size', String(opts.size));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiFetch<Page<RecentReview>>(`/reviews/scraps${suffix}`);
}

/* ===================== 게시판 ===================== */

export interface PostOut {
  id: number;
  author_nickname: string;
  is_mine: boolean;
  region_id: string;
  region_name: string;
  station_id: number | null;
  station_name: string | null;
  title: string;
  body: string;
  comment_count: number;
  score: number;
  my_vote: number;
  is_scrapped: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface PostCreatePayload {
  region_id: string;
  station_id?: number | null;
  title: string;
  body: string;
}

export interface PostReceipt {
  id: number;
  message: string;
}

export function listPosts(opts?: { regionId?: string; stationId?: number; sort?: 'new' | 'top'; page?: number; size?: number }) {
  const qs = new URLSearchParams();
  if (opts?.regionId) qs.set('region_id', opts.regionId);
  if (opts?.stationId) qs.set('station_id', String(opts.stationId));
  if (opts?.sort) qs.set('sort', opts.sort);
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.size) qs.set('size', String(opts.size));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiFetch<Page<PostOut>>(`/posts${suffix}`);
}

export function getPopularPosts(opts?: { regionId?: string; days?: number; limit?: number }) {
  const qs = new URLSearchParams();
  if (opts?.regionId) qs.set('region_id', opts.regionId);
  if (opts?.days) qs.set('days', String(opts.days));
  if (opts?.limit) qs.set('limit', String(opts.limit));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiFetch<PostOut[]>(`/posts/popular${suffix}`, { revalidateSeconds: 60 });
}

export const createPost = (payload: PostCreatePayload) => apiFetch<PostReceipt>('/posts', { method: 'POST', body: JSON.stringify(payload) });
export const getPost = (id: number) => apiFetch<PostOut>(`/posts/${id}`);
export const deletePost = (id: number) => apiFetch<void>(`/posts/${id}`, { method: 'DELETE' });
export const votePost = (postId: number, value: 1 | -1 | 0) => vote(`/posts/${postId}/vote`, value);
export const getPostComments = (postId: number) => apiFetch<CommentOut[]>(`/posts/${postId}/comments`);
export const createPostComment = (postId: number, body: string, parentId?: number) =>
  apiFetch<CommentOut>(`/posts/${postId}/comments`, { method: 'POST', body: JSON.stringify({ body, parent_id: parentId ?? null }) });
export const deletePostComment = (commentId: number) => apiFetch<void>(`/post-comments/${commentId}`, { method: 'DELETE' });
export const scrapPost = (postId: number) => apiFetch<ScrapStatus>(`/posts/${postId}/scrap`, { method: 'POST' });
export const unscrapPost = (postId: number) => apiFetch<ScrapStatus>(`/posts/${postId}/scrap`, { method: 'DELETE' });
export function getMyPostScraps(opts?: { page?: number; size?: number }) {
  const qs = new URLSearchParams();
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.size) qs.set('size', String(opts.size));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiFetch<Page<PostOut>>(`/me/scraps/posts${suffix}`);
}

/* ===================== 관리자 ===================== */

export interface AdminReview {
  id: number;
  station_id: number;
  station_name: string;
  role: string;
  role_label: string;
  case_type: string;
  case_type_label: string;
  case_number: string | null;
  ratings: Record<string, number | null>;
  body: string;
  status: string;
  reject_reason: string | null;
  created_at: string | null;
  evidence_note: string | null;
  evidence_verified: boolean;
}

export const listAdminReviews = (opts: { status: string; page?: number; size?: number }) => {
  const qs = new URLSearchParams({ status: opts.status });
  if (opts.page) qs.set('page', String(opts.page));
  if (opts.size) qs.set('size', String(opts.size));
  return apiFetch<Page<AdminReview>>(`/admin/reviews?${qs}`);
};
export const approveReview = (id: number) => apiFetch<AdminReview>(`/admin/reviews/${id}/approve`, { method: 'POST' });
export const rejectReview = (id: number, reason: string) =>
  apiFetch<AdminReview>(`/admin/reviews/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
// 2026-10 결정 이후 즉시 게시된 평가를 운영자가 사후에 내리는 조치(approve/reject 는 레거시 대기열 전용).
export const removeReview = (id: number, reason: string) =>
  apiFetch<AdminReview>(`/admin/reviews/${id}/remove`, { method: 'POST', body: JSON.stringify({ reason }) });
export const setReviewEvidence = (id: number, verified: boolean) =>
  apiFetch<AdminReview>(`/admin/reviews/${id}/evidence`, { method: 'PATCH', body: JSON.stringify({ verified }) });

export interface AdminVerifyOut extends VerifyOut {
  user_id: number;
  user_email: string;
  user_nickname: string;
}

export const listAdminVerifications = (opts: { status: string; page?: number; size?: number }) => {
  const qs = new URLSearchParams({ status: opts.status });
  if (opts.page) qs.set('page', String(opts.page));
  if (opts.size) qs.set('size', String(opts.size));
  return apiFetch<Page<AdminVerifyOut>>(`/admin/officer-verifications?${qs}`);
};
export const approveVerification = (id: number) =>
  apiFetch<AdminVerifyOut>(`/admin/officer-verifications/${id}/approve`, { method: 'POST' });
export const rejectVerification = (id: number, reason: string) =>
  apiFetch<AdminVerifyOut>(`/admin/officer-verifications/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) });
export const revokeVerification = (id: number, reason: string) =>
  apiFetch<AdminVerifyOut>(`/admin/officer-verifications/${id}/revoke`, { method: 'POST', body: JSON.stringify({ reason }) });

export interface AdminTakedown {
  id: number;
  public_code: string;
  target_type: 'review' | 'officer';
  review_id: number | null;
  officer_id: number | null;
  request_type: 'delete' | 'correct';
  requester_name: string;
  requester_contact: string;
  relation: string;
  reason: string;
  status: string;
  created_at: string | null;
  due_at: string | null;
  overdue: boolean;
  resolved_at: string | null;
  resolution_note: string | null;
}

export const listAdminTakedowns = (opts: { status: string; page?: number; size?: number }) => {
  const qs = new URLSearchParams({ status: opts.status });
  if (opts.page) qs.set('page', String(opts.page));
  if (opts.size) qs.set('size', String(opts.size));
  return apiFetch<Page<AdminTakedown>>(`/admin/takedown-requests?${qs}`);
};
export const resolveTakedown = (id: number, decision: 'keep' | 'remove', note: string) =>
  apiFetch<AdminTakedown>(`/admin/takedown-requests/${id}/resolve`, { method: 'POST', body: JSON.stringify({ decision, note }) });
