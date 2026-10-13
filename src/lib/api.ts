/**
 * 백엔드(FastAPI) 클라이언트. 서버 컴포넌트·클라이언트 컴포넌트 양쪽에서 쓴다.
 * 타입은 backend/app/schemas/public.py, review.py 의 Pydantic 스키마와 1:1로 맞춘다.
 */
// 서버 컴포넌트(SSR)는 같은 EC2 박스 안에서 돌아가므로 공인 도메인으로 다시 나갔다 들어오는
// 홀펀(hairpin) 경로를 타면 안 된다 — 이 경로는 AWS VPC에서 간헐적으로 끊긴다(자기 자신의
// 공인 IP로는 안정적으로 되돌아오지 못하는 경우가 흔함). 그래서 서버 쪽만 내부 전용
// INTERNAL_API_BASE_URL(루프백)을 우선 쓰고, 브라우저(클라이언트 컴포넌트)는 항상 공개
// NEXT_PUBLIC_API_BASE_URL 을 쓴다.
const API_BASE = typeof window === 'undefined'
  ? (process.env.INTERNAL_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8001')
  : (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8001');

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
  up: number;
  down: number;
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

export interface CaseTypeSummary {
  case_type: string;
  case_type_label: string;
  rating: RatingSummary;
}

export interface NearbyStation {
  id: number;
  name: string;
  distance_km: number;
  rating: RatingSummary;
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
  by_case_type: CaseTypeSummary[];
  nearby: NearbyStation[];
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

export function getStation(id: number | string, opts?: { page?: number; size?: number; evidenceOnly?: boolean }) {
  const qs = new URLSearchParams();
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.size) qs.set('size', String(opts.size));
  if (opts?.evidenceOnly) qs.set('evidence_only', 'true');
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

export interface TransparencyQuarter {
  year: number;
  quarter: number;
  reviews_rejected: number;
  reviews_removed: number;
  reports_resolved_remove: number;
  reports_resolved_dismiss: number;
  takedowns_removed: number;
  takedowns_kept: number;
}
export interface TransparencyReport {
  quarters: TransparencyQuarter[];
}
export const getTransparencyReport = () =>
  apiFetch<TransparencyReport>('/stats/transparency', { revalidateSeconds: 60 });

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
  // role/case_type 이 'other' 일 때만 쓰는 직접입력 라벨. 비우면 '기타'로 표시된다.
  role_other?: string | null;
  case_type_other?: string | null;
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
  target_type: 'review' | 'officer' | 'public_case';
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
export const deleteAccount = (password: string) =>
  apiFetch<void>('/auth/me', { method: 'DELETE', body: JSON.stringify({ password }) });

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
  blind_reason?: string | null;
  created_at: string | null;
  published_at: string | null;
  comment_count: number;
  up: number;
  down: number;
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
  up: number;
  down: number;
  score: number;
  my_vote: number;
  created_at: string | null;
  removed_at: string | null;
  replies: CommentOut[];
}

const vote = (path: string, value: 1 | -1 | 0) =>
  apiFetch<VoteSummary>(path, { method: 'POST', body: JSON.stringify({ value }) });

export interface ScrapStatus {
  scrapped: boolean;
}

/* ===================== 신고 ===================== */

export type ReportTargetType = 'review' | 'post' | 'review_comment' | 'post_comment' | 'review_reply' | 'public_case';
// 블라인드 대상이 되는 "게시물" 3종(댓글·해명은 신고만 가능, 블라인드 대상 아님).
export type BlindableType = 'review' | 'post' | 'public_case';

export interface ReportReceipt {
  id: number;
  message: string;
}

export const createReport = (targetType: ReportTargetType, targetId: number, reason: string) =>
  apiFetch<ReportReceipt>('/reports', {
    method: 'POST', body: JSON.stringify({ target_type: targetType, target_id: targetId, reason }),
  });

export const getReview = (reviewId: number) => apiFetch<RecentReview>(`/reviews/${reviewId}`);
export const voteReview = (reviewId: number, value: 1 | -1 | 0) => vote(`/reviews/${reviewId}/vote`, value);
export const getReviewComments = (reviewId: number, sort: 'new' | 'top' = 'new') =>
  apiFetch<CommentOut[]>(`/reviews/${reviewId}/comments?sort=${sort}`);
export const voteReviewComment = (commentId: number, value: 1 | -1 | 0) => vote(`/reviews/comments/${commentId}/vote`, value);
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

export type PostCategory = 'info' | 'question' | 'chat' | 'suggestion' | 'other';
export type PopularPeriod = 'today' | 'week' | 'month' | 'all';

export interface PostOut {
  id: number;
  author_nickname: string;
  is_mine: boolean;
  region_id: string | null;
  region_name: string | null;
  station_id: number | null;
  station_name: string | null;
  category: PostCategory;
  category_label: string;
  title: string;
  body: string;
  view_count: number;
  comment_count: number;
  up: number;
  down: number;
  score: number;
  my_vote: number;
  is_scrapped: boolean;
  created_at: string | null;
  updated_at: string | null;
  // 블라인드된 글은 작성자 본인·관리자에게만 응답된다.
  is_blinded?: boolean;
  blind_reason?: string | null;
}

export interface PostCreatePayload {
  region_id?: string | null;
  station_id?: number | null;
  category: PostCategory;
  title: string;
  body: string;
}

export interface PostReceipt {
  id: number;
  message: string;
}

export function listPosts(opts?: {
  regionId?: string; stationId?: number; category?: PostCategory; q?: string; sort?: 'new' | 'top';
  page?: number; size?: number;
}) {
  const qs = new URLSearchParams();
  if (opts?.regionId) qs.set('region_id', opts.regionId);
  if (opts?.stationId) qs.set('station_id', String(opts.stationId));
  if (opts?.category) qs.set('category', opts.category);
  if (opts?.q) qs.set('q', opts.q);
  if (opts?.sort) qs.set('sort', opts.sort);
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.size) qs.set('size', String(opts.size));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiFetch<Page<PostOut>>(`/posts${suffix}`);
}

// 게시글 카테고리 + 평가를 가리키는 가상 카테고리('review').
export type BoardFeedCategory = PostCategory | 'review';

/** 게시판 피드 한 줄 — 자유게시글과 평가를 섞어서 보여주는 공용 모양(2026-10 결정, 의뢰인 요청).
 * kind 로 글 종류를 구분해서 카드 UI를 다르게 그린다. title 은 게시글에만, role_label·overall 은
 * 평가에만 있다. */
export interface BoardFeedItem {
  kind: 'post' | 'review';
  id: number;
  region_name: string | null;
  station_id: number | null;
  station_name: string | null;
  category: string;
  category_label: string;
  title: string | null;
  body: string;
  author_nickname: string | null;
  is_mine: boolean;
  role_label: string | null;
  overall: number | null;
  evidence_verified: boolean | null;
  view_count: number | null;
  comment_count: number;
  up: number;
  down: number;
  score: number;
  my_vote: number;
  is_scrapped: boolean;
  created_at: string | null;
}

export function listBoardFeed(opts?: {
  regionId?: string; category?: BoardFeedCategory; q?: string; sort?: 'new' | 'top'; period?: PopularPeriod;
  page?: number; size?: number;
}) {
  const qs = new URLSearchParams();
  if (opts?.regionId) qs.set('region_id', opts.regionId);
  if (opts?.category) qs.set('category', opts.category);
  if (opts?.q) qs.set('q', opts.q);
  if (opts?.sort) qs.set('sort', opts.sort);
  if (opts?.period) qs.set('period', opts.period);
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.size) qs.set('size', String(opts.size));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiFetch<Page<BoardFeedItem>>(`/board/feed${suffix}`);
}

export function getPopularPosts(opts?: { regionId?: string; period?: PopularPeriod; limit?: number }) {
  const qs = new URLSearchParams();
  if (opts?.regionId) qs.set('region_id', opts.regionId);
  if (opts?.period) qs.set('period', opts.period);
  if (opts?.limit) qs.set('limit', String(opts.limit));
  const suffix = qs.toString() ? `?${qs}` : '';
  return apiFetch<PostOut[]>(`/posts/popular${suffix}`, { revalidateSeconds: 60 });
}

export const createPost = (payload: PostCreatePayload) => apiFetch<PostReceipt>('/posts', { method: 'POST', body: JSON.stringify(payload) });
export const getPost = (id: number) => apiFetch<PostOut>(`/posts/${id}`);
export const deletePost = (id: number) => apiFetch<void>(`/posts/${id}`, { method: 'DELETE' });
export const incrementPostView = (id: number) => apiFetch<void>(`/posts/${id}/view`, { method: 'POST' });
export const votePost = (postId: number, value: 1 | -1 | 0) => vote(`/posts/${postId}/vote`, value);
export const getPostComments = (postId: number, sort: 'new' | 'top' = 'new') =>
  apiFetch<CommentOut[]>(`/posts/${postId}/comments?sort=${sort}`);
export const votePostComment = (commentId: number, value: 1 | -1 | 0) => vote(`/post-comments/${commentId}/vote`, value);
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

export interface UserStatsOut {
  total_users: number;
  new_7d: number;
  new_30d: number;
  officer_verified: number;
  daily_signups: [string, number][];
}
export const getAdminUserStats = () => apiFetch<UserStatsOut>('/admin/stats/users');

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

export interface AdminReportOut {
  id: number;
  reporter_nickname: string;
  target_type: ReportTargetType;
  target_id: number;
  target_preview: string;
  reason: string;
  status: 'pending' | 'resolved';
  resolved_by: number | null;
  resolution_action: 'removed' | 'dismissed' | null;
  resolution_note: string | null;
  created_at: string | null;
  target_blinded: boolean | null;
  target_blind_auto: boolean;
  pending_reporters: number;
}

export const listAdminReports = (opts: { status: string; page?: number; size?: number }) => {
  const qs = new URLSearchParams({ status: opts.status });
  if (opts.page) qs.set('page', String(opts.page));
  if (opts.size) qs.set('size', String(opts.size));
  return apiFetch<Page<AdminReportOut>>(`/admin/reports?${qs}`);
};
export const resolveReport = (id: number, action: 'remove' | 'dismiss', note: string) =>
  apiFetch<AdminReportOut>(`/admin/reports/${id}/resolve`, { method: 'POST', body: JSON.stringify({ action, note }) });

export interface AuditLogOut {
  id: number;
  actor_id: number | null;
  actor_email: string | null;
  action: string;
  target_type: string;
  target_id: number | null;
  detail: Record<string, unknown> | null;
  created_at: string | null;
}

export const listAuditLogs = (opts?: { action?: string; page?: number; size?: number }) => {
  const qs = new URLSearchParams();
  if (opts?.action) qs.set('action', opts.action);
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.size) qs.set('size', String(opts.size));
  return apiFetch<Page<AuditLogOut>>(`/admin/audit-logs?${qs}`);
};

export interface AdminTakedown {
  id: number;
  public_code: string;
  target_type: 'review' | 'officer' | 'public_case';
  review_id: number | null;
  officer_id: number | null;
  case_id: number | null;
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


/* ===================== 블라인드(관리자) ===================== */

export const adminBlind = (targetType: BlindableType, targetId: number, reason?: string) =>
  apiFetch<void>('/admin/blind', { method: 'POST', body: JSON.stringify({ target_type: targetType, target_id: targetId, reason: reason || null }) });
export const adminUnblind = (targetType: BlindableType, targetId: number) =>
  apiFetch<void>('/admin/unblind', { method: 'POST', body: JSON.stringify({ target_type: targetType, target_id: targetId }) });

export interface BlindedItem {
  target_type: BlindableType;
  target_id: number;
  title: string;
  blind_reason: string | null;
  is_auto: boolean;
  pending_reporters: number;
}
export const listAdminBlinded = () => apiFetch<BlindedItem[]>('/admin/blinded');

export function getMyPosts(opts?: { page?: number; size?: number }) {
  const qs = new URLSearchParams();
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.size) qs.set('size', String(opts.size));
  return apiFetch<Page<PostOut>>(`/posts/mine${qs.toString() ? `?${qs}` : ''}`);
}

/* ===================== 사건 공론화 ===================== */

export type CaseCategory = 'delay' | 'procedure' | 'evidence' | 'attitude' | 'other';
export const CASE_CATEGORIES: [CaseCategory, string][] = [
  ['delay', '수사 지연'], ['procedure', '조사 절차'], ['evidence', '증거 처리'], ['attitude', '응대 문제'], ['other', '기타'],
];

export interface CaseCard {
  id: number;
  category: CaseCategory;
  category_label: string;
  title: string;
  excerpt: string;
  station_id: number | null;
  station_name: string | null;
  empathy_count: number;
  view_count: number;
  update_count: number;
  created_at: string | null;
  my_empathy: boolean;
}

export interface CaseUpdateOut {
  id: number;
  body: string;
  created_at: string | null;
}

export interface CaseDetail extends CaseCard {
  body: string;
  desired_action: string | null;
  updates: CaseUpdateOut[];
  is_mine: boolean;
  status: 'published' | 'held' | 'blinded' | 'removed';
  hold_reason: string | null;
  blind_reason: string | null;
}

export interface CaseCreatePayload {
  category: CaseCategory;
  title: string;
  body: string;
  desired_action?: string | null;
  station_id?: number | null;
  agreed: boolean;
}

export interface MyCaseOut {
  id: number;
  title: string;
  category_label: string;
  status: 'published' | 'held' | 'blinded' | 'removed';
  hold_reason: string | null;
  blind_reason: string | null;
  removed_reason: string | null;
  empathy_count: number;
  created_at: string | null;
}

export function listCases(opts?: { category?: CaseCategory; q?: string; sort?: 'new' | 'empathy'; page?: number; size?: number }) {
  const qs = new URLSearchParams();
  if (opts?.category) qs.set('category', opts.category);
  if (opts?.q) qs.set('q', opts.q);
  if (opts?.sort) qs.set('sort', opts.sort);
  if (opts?.page) qs.set('page', String(opts.page));
  if (opts?.size) qs.set('size', String(opts.size));
  return apiFetch<Page<CaseCard>>(`/cases${qs.toString() ? `?${qs}` : ''}`);
}
export const getCase = (id: number) => apiFetch<CaseDetail>(`/cases/${id}`);
export const incrementCaseView = (id: number) => apiFetch<void>(`/cases/${id}/view`, { method: 'POST' });
export const createCase = (payload: CaseCreatePayload) =>
  apiFetch<{ id: number; status: string; message: string }>('/cases', { method: 'POST', body: JSON.stringify(payload) });
export const deleteCase = (id: number) => apiFetch<void>(`/cases/${id}`, { method: 'DELETE' });
export const addEmpathy = (id: number) => apiFetch<{ empathized: boolean; empathy_count: number }>(`/cases/${id}/empathy`, { method: 'POST' });
export const removeEmpathy = (id: number) => apiFetch<{ empathized: boolean; empathy_count: number }>(`/cases/${id}/empathy`, { method: 'DELETE' });
export const addCaseUpdate = (id: number, body: string) =>
  apiFetch<CaseUpdateOut>(`/cases/${id}/updates`, { method: 'POST', body: JSON.stringify({ body }) });
export const getMyCases = () => apiFetch<MyCaseOut[]>('/cases/mine');

export interface AdminCaseOut {
  id: number;
  author_nickname: string | null;
  title: string;
  body: string;
  desired_action: string | null;
  category_label: string;
  station_name: string | null;
  status: 'published' | 'held' | 'blinded' | 'removed';
  hold_reason: string | null;
  blind_reason: string | null;
  empathy_count: number;
  pending_reporters: number;
  created_at: string | null;
}
export const listAdminCases = (status: string, page = 1) =>
  apiFetch<Page<AdminCaseOut>>(`/admin/cases?status=${status}&page=${page}`);
export const approveCase = (id: number) => apiFetch<void>(`/admin/cases/${id}/approve`, { method: 'POST' });
export const removeCaseAdmin = (id: number, reason: string) =>
  apiFetch<void>(`/admin/cases/${id}/remove`, { method: 'POST', body: JSON.stringify({ reason }) });

/* ===================== 광고·제휴 ===================== */

// 업로드된 광고 이미지·클릭 리다이렉트는 API 서버 경로라, 브라우저에서 쓸 땐 공개 API 주소를 붙인다
// (운영에선 같은 도메인이라 상관없지만 로컬 개발은 프론트 3000 / API 8001 로 갈라져 있다).
export const apiAsset = (path: string) =>
  `${process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8001'}${path}`;

export interface AdOut {
  id: number;
  title: string;
  advertiser: string;
  image_wide_url: string;
  image_side_url: string | null;
  click_url: string;
  region_name: string | null;
}

export function listAds(opts: { regionId?: string; stationId?: number; slot?: 'wide' | 'side'; limit?: number }) {
  const qs = new URLSearchParams();
  if (opts.regionId) qs.set('region_id', opts.regionId);
  if (opts.stationId) qs.set('station_id', String(opts.stationId));
  if (opts.slot) qs.set('slot', opts.slot);
  if (opts.limit) qs.set('limit', String(opts.limit));
  return apiFetch<AdOut[]>(`/ads?${qs}`);
}

export type InquiryType = 'ad' | 'partnership' | 'other';
export interface InquiryPayload {
  inquiry_type: InquiryType;
  company: string;
  name: string;
  contact: string;
  region_interest?: string | null;
  message: string;
  agreed: boolean;
}
export const createInquiry = (p: InquiryPayload) =>
  apiFetch<{ id: number; message: string }>('/ad-inquiries', { method: 'POST', body: JSON.stringify(p) });

export interface AdminAd {
  id: number;
  title: string;
  advertiser: string;
  link_url: string;
  region_id: string | null;
  region_name: string | null;
  image_wide_url: string;
  image_side_url: string | null;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  is_live: boolean;
  impressions: number;
  clicks: number;
}
export const listAdminAds = () => apiFetch<AdminAd[]>('/admin/ads');
// 파일 업로드라 JSON 이 아닌 FormData 로 보낸다(apiFetch 는 JSON 전용이라 직접 fetch).
export async function createAdminAd(form: FormData): Promise<AdminAd> {
  const res = await fetch(apiAsset('/api/v1/admin/ads'), { method: 'POST', body: form, credentials: 'include' });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body);
  return body as AdminAd;
}
export const updateAdminAd = (id: number, patch: Partial<Pick<AdminAd, 'title' | 'advertiser' | 'link_url' | 'starts_on' | 'ends_on' | 'is_active'>>) =>
  apiFetch<AdminAd>(`/admin/ads/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
export const deleteAdminAd = (id: number) => apiFetch<void>(`/admin/ads/${id}`, { method: 'DELETE' });

export interface AdminInquiry {
  id: number;
  inquiry_type: InquiryType;
  inquiry_type_label: string;
  company: string;
  name: string;
  contact: string;
  region_interest: string | null;
  message: string;
  status: 'new' | 'done';
  admin_note: string | null;
  created_at: string | null;
}
export const listAdminInquiries = (status: 'new' | 'done') => apiFetch<Page<AdminInquiry>>(`/admin/inquiries?status=${status}`);
export const markInquiryDone = (id: number, note: string) =>
  apiFetch<void>(`/admin/inquiries/${id}/done`, { method: 'POST', body: JSON.stringify({ note }) });
