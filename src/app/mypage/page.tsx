'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bookmark, Eye, FileText, Info, LogOut, MapPin, MessageSquare, ShieldCheck, ThumbsDown, ThumbsUp, UserX, X,
} from 'lucide-react';
import { Card, PageHead, Score } from '@/components/ui';
import { formatDate } from '@/lib/format';
import {
  ApiError, deleteAccount, followRegion, getMe, getMyRegions, getMyReviews, getMyReviewScraps, getMyPostScraps,
  getRegions, logout, unfollowRegion,
  type MyReviewOut, type Page, type PostOut, type RecentReview, type RegionFollowOut, type RegionOut, type UserOut,
} from '@/lib/api';

const STATUS_LABEL: Record<MyReviewOut['status'], { label: string; tone: string }> = {
  pending: { label: '검수 대기', tone: 'mid' },
  published: { label: '게시됨', tone: 'good' },
  rejected: { label: '반려됨', tone: 'low' },
  blinded: { label: '임시조치', tone: 'mid' },
  removed: { label: '삭제됨', tone: 'low' },
};

const SIZE = 20;

function RegionFollows() {
  const [all, setAll] = useState<RegionOut[]>([]);
  const [mine, setMine] = useState<RegionFollowOut[] | null>(null);
  const [adding, setAdding] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getRegions(), getMyRegions()])
      .then(([a, m]) => { setAll(a); setMine(m); })
      .catch(() => setError('지역 정보를 불러오지 못했습니다.'));
  }, []);

  const followedIds = new Set((mine ?? []).map((r) => r.region_id));
  const options = all.filter((r) => !followedIds.has(r.id));

  const add = async () => {
    if (!adding) return;
    setBusy(true); setError(null);
    try {
      const f = await followRegion(adding);
      setMine((m) => [...(m ?? []), f]);
      setAdding('');
    } catch { setError('등록하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
    setBusy(false);
  };

  const remove = async (regionId: string) => {
    setBusy(true); setError(null);
    try {
      await unfollowRegion(regionId);
      setMine((m) => (m ?? []).filter((r) => r.region_id !== regionId));
    } catch { setError('삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.'); }
    setBusy(false);
  };

  return (
    <Card>
      <h2><MapPin size={17} style={{ verticalAlign: -3, marginRight: 5, color: 'var(--brand)' }} />관심 지역</h2>
      <p className="sub">등록하면 홈 화면 상단에 그 지역 경찰서의 새 평가 소식을 먼저 보여드립니다.</p>
      {error && <div className="warn">{error}</div>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '14px 0' }}>
        {mine === null ? (
          <p className="sub">불러오는 중…</p>
        ) : mine.length === 0 ? (
          <p className="sub">등록된 관심 지역이 없습니다.</p>
        ) : (
          mine.map((r) => (
            <span key={r.region_id} className="badge brand chip">
              {r.region_name}
              <button type="button" onClick={() => remove(r.region_id)} disabled={busy} aria-label={`${r.region_name} 관심 지역 해제`}>
                <X size={12} />
              </button>
            </span>
          ))
        )}
      </div>
      {options.length > 0 && (
        <div className="btn-row">
          <select className="sel" value={adding} onChange={(e) => setAdding(e.target.value)} aria-label="지역 선택">
            <option value="">지역 선택</option>
            {options.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
          </select>
          <button type="button" className="btn line sm" onClick={add} disabled={!adding || busy}>추가</button>
        </div>
      )}
    </Card>
  );
}

function MyScraps() {
  const [reviews, setReviews] = useState<RecentReview[] | null>(null);
  const [posts, setPosts] = useState<PostOut[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getMyReviewScraps({ size: 10 }), getMyPostScraps({ size: 10 })])
      .then(([r, p]) => { setReviews(r.items); setPosts(p.items); })
      .catch(() => setError('스크랩 목록을 불러오지 못했습니다.'));
  }, []);

  if (reviews !== null && posts !== null && reviews.length === 0 && posts.length === 0) return null;

  return (
    <Card>
      <h2><Bookmark size={17} style={{ verticalAlign: -3, marginRight: 5, color: 'var(--brand)' }} />내 스크랩</h2>
      {error && <div className="warn">{error}</div>}
      {reviews === null || posts === null ? (
        <p className="sub">불러오는 중…</p>
      ) : (
        <>
          {reviews.length > 0 && (
            <>
              <p className="sub scrap-sub">스크랩한 평가</p>
              {reviews.map((rv) => (
                <Link href={`/station/${rv.station_id}`} className="post-row" key={rv.id}>
                  <div className="post-row-top">
                    <span className="badge brand">{rv.role_label}</span>
                    <span className="sub">{rv.station_name}</span>
                  </div>
                  <div className="post-row-title">
                    {rv.body ? rv.body.slice(0, 70) + (rv.body.length > 70 ? '…' : '') : '(서술 없음, 별점만 등록)'}
                  </div>
                  <div className="post-row-meta">
                    <span className="sub">{formatDate(rv.published_at)}</span>
                    {rv.evidence_verified && <span className="badge good"><ShieldCheck size={11} />증빙확인</span>}
                  </div>
                </Link>
              ))}
            </>
          )}
          {posts.length > 0 && (
            <>
              <p className="sub scrap-sub">스크랩한 게시글</p>
              {posts.map((p) => (
                <Link href={`/board/${p.id}`} className="post-row" key={p.id}>
                  <div className="post-row-top">
                    <span className={`badge cat-${p.category}`}>{p.category_label}</span>
                    <span className="sub">{p.region_name ?? '전체'}{p.station_name ? ` · ${p.station_name}` : ''}</span>
                  </div>
                  <div className="post-row-title">{p.title}</div>
                  <div className="post-row-meta">
                    <span className="who">{p.author_nickname}</span>
                    <span className="sub">{formatDate(p.created_at)}</span>
                    <span className="stat"><Eye size={12} />{p.view_count}</span>
                    <span className="stat"><ThumbsUp size={12} />{p.up}</span>
                    <span className="stat"><ThumbsDown size={12} />{p.down}</span>
                    <span className="stat"><MessageSquare size={12} />{p.comment_count}</span>
                  </div>
                </Link>
              ))}
            </>
          )}
        </>
      )}
    </Card>
  );
}

/** 탈퇴는 되돌릴 수 없어서 로그인 세션과 별개로 비밀번호를 한 번 더 받는다(백엔드도 같은
 * 전제로 비밀번호를 다시 검사한다, backend/app/api/v1/auth.py 참고). 작성한 평가·게시글은
 * 지워지지 않고 "익명"으로 바뀔 뿐이라는 걸 누르기 전에 미리 알려 준다. */
function WithdrawAccount() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!confirm('정말 탈퇴하시겠어요? 되돌릴 수 없습니다.')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteAccount(password);
      router.replace('/');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setError('비밀번호가 올바르지 않습니다.');
      else setError('탈퇴하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  return (
    <Card className="flat notice-card">
      <div className="ico danger"><UserX size={18} /></div>
      {!open ? (
        <>
          <p className="sub">더 이상 이용하지 않으신다면 탈퇴할 수 있습니다. 작성한 평가·게시글은 삭제되지 않고 &quot;익명&quot;으로 남습니다.</p>
          <button type="button" className="btn line sm danger" onClick={() => setOpen(true)}>회원 탈퇴</button>
        </>
      ) : (
        <div style={{ flex: 1, minWidth: 220 }}>
          <p className="sub" style={{ marginBottom: 8 }}>탈퇴하려면 비밀번호를 입력하세요. 계정은 즉시 비활성화되고 되돌릴 수 없습니다.</p>
          <div className="btn-row">
            <div className="field" style={{ margin: 0, maxWidth: 200 }}>
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호" autoComplete="current-password"
              />
            </div>
            <button type="button" className="btn sm danger" onClick={submit} disabled={!password || busy}>
              {busy ? '처리 중…' : '탈퇴 확인'}
            </button>
            <button
              type="button" className="btn line sm"
              onClick={() => { setOpen(false); setPassword(''); setError(null); }}
            >
              취소
            </button>
          </div>
          {error && <div className="warn" style={{ marginTop: 8 }}>{error}</div>}
        </div>
      )}
    </Card>
  );
}

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserOut | null>(null);
  const [data, setData] = useState<Page<MyReviewOut> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 의존성 배열을 [router]로 두면, 로그아웃/탈퇴로 router.replace('/') 를 호출해 페이지를
    // 벗어나는 바로 그 순간에도(아직 마운트 해제 전) useRouter() 가 새 참조를 돌려줘 이
    // effect가 다시 돌아 getMe() 를 또 호출하는 경쟁 상태가 있었다 — 그 시점엔 쿠키가 이미
    // 지워져 있어 401 → router.replace('/login?next=/mypage') 가 먼저 한 replace('/') 를
    // 덮어써 버렸다(실사용자 테스트로 발견). 마운트 시 한 번만 돌면 되므로 []로 고정한다.
    getMe()
      .then(setUser)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace('/login?next=/mypage');
        else setError('내 정보를 불러오지 못했습니다.');
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadReviews = useCallback(() => {
    getMyReviews({ page, size: SIZE }).then(setData).catch(() => setError('내가 쓴 글을 불러오지 못했습니다.'));
  }, [page]);

  useEffect(() => {
    if (user) loadReviews();
  }, [user, loadReviews]);

  const doLogout = async () => {
    await logout().catch(() => {});
    router.replace('/');
  };

  if (loading) return <Card><p className="sub">불러오는 중…</p></Card>;
  if (!user) return null; // 401 처리 중 리다이렉트

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <>
      <PageHead title="마이페이지" />

      <Card className="profile-head">
        <div className="profile-avatar">{user.nickname.charAt(0)}</div>
        <div className="profile-info">
          <h2 style={{ marginBottom: 2 }}>{user.nickname}님</h2>
          <p className="email">{user.email}</p>
          {user.officer_station_id && (
            <div className="profile-badges">
              <span className="badge good"><ShieldCheck size={11} />{user.officer_station_name} 인증</span>
            </div>
          )}
        </div>
        <button className="btn line sm" onClick={doLogout}><LogOut size={14} />로그아웃</button>
      </Card>

      <Card className="flat notice-card">
        <div className="ico"><Info size={18} /></div>
        <p className="sub">계정 없이 작성한 평가는 여기 목록에 나타나지 않습니다(계정과 연결되지 않아요).</p>
      </Card>

      <Card className="flat notice-card">
        <div className={`ico${user.officer_station_id ? ' good' : ''}`}><ShieldCheck size={18} /></div>
        {user.officer_station_id ? (
          <p className="sub">{user.officer_station_name} 소속({user.officer_rank})으로 인증된 계정입니다.</p>
        ) : (
          <p className="sub">경찰관이신가요? 신원 인증을 받으면 소속 경찰서 평가에 해명을 남길 수 있어요.</p>
        )}
        <Link href="/officer-verify" className="btn line sm">
          {user.officer_station_id ? '인증 정보 보기' : '경찰관 인증 신청'}
        </Link>
      </Card>

      <RegionFollows />
      <MyScraps />

      <Card>
        <h2><FileText size={17} style={{ verticalAlign: -3, marginRight: 5, color: 'var(--brand)' }} />내가 쓴 평가</h2>
        {error && <div className="warn">{error}</div>}
        {data === null ? (
          <p className="sub">불러오는 중…</p>
        ) : data.items.length ? (
          data.items.map((r) => {
            const st = STATUS_LABEL[r.status];
            return (
              <div className="review" key={r.id}>
                <div className="meta">
                  <span className="badge brand">{r.role_label}</span><span className="badge">{r.case_type_label}</span>
                  {formatDate(r.created_at)}
                  {r.evidence_verified && <span className="badge good"><ShieldCheck size={11} />증빙확인</span>}
                </div>
                <div className="head"><Score value={r.overall} /></div>
                <p><Link href={`/station/${r.station_id}`}>{r.station_name}</Link></p>
                <div className="post-row-meta sub" style={{ marginTop: 8 }}>
                  <span className={`badge ${st.tone}`}>{st.label}</span>
                  <span className="stat"><ThumbsUp size={12} />{r.up}</span>
                  <span className="stat"><ThumbsDown size={12} />{r.down}</span>
                  <span>댓글 {r.comment_count}</span>
                </div>
                {r.status === 'rejected' && r.reject_reason && (
                  <div className="guidebox" style={{ marginTop: 10, marginBottom: 0 }}>
                    <b>반려 사유</b>
                    <p className="sub" style={{ marginTop: 4 }}>{r.reject_reason}</p>
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <p className="sub">아직 작성한 평가가 없습니다.</p>
        )}
        {totalPages > 1 && (
          <div className="btn-row" style={{ marginTop: 16, justifyContent: 'center' }}>
            <button className="btn line sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>이전</button>
            <span className="sub" style={{ alignSelf: 'center' }}>{page} / {totalPages}</span>
            <button className="btn line sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>다음</button>
          </div>
        )}
      </Card>

      <WithdrawAccount />
    </>
  );
}
