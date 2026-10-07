'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut, ShieldCheck, X } from 'lucide-react';
import { Card, PageHead, Score, TableWrap } from '@/components/ui';
import { formatDate } from '@/lib/format';
import {
  ApiError, followRegion, getMe, getMyRegions, getMyReviews, getRegions, logout, unfollowRegion,
  type MyReviewOut, type Page, type RegionFollowOut, type RegionOut, type UserOut,
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
      <h2>관심 지역</h2>
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

export default function MyPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserOut | null>(null);
  const [data, setData] = useState<Page<MyReviewOut> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then(setUser)
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace('/login?next=/mypage');
        else setError('내 정보를 불러오지 못했습니다.');
      })
      .finally(() => setLoading(false));
  }, [router]);

  const loadReviews = useCallback(() => {
    getMyReviews({ page, size: SIZE }).then(setData).catch(() => setError('내가 쓴 글을 불러오지 못했습니다.'));
  }, [page]);

  useEffect(() => {
    if (user) loadReviews();
  }, [user, loadReviews]);

  const doLogout = async () => {
    await logout().catch(() => {});
    router.replace('/');
    router.refresh();
  };

  if (loading) return <Card><p className="sub">불러오는 중…</p></Card>;
  if (!user) return null; // 401 처리 중 리다이렉트

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <>
      <PageHead eyebrow="마이페이지" title={`${user.nickname}님`} sub={user.email} />

      <Card className="flat" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <p className="sub">계정 없이 작성한 평가는 여기 목록에 나타나지 않습니다(계정과 연결되지 않아요).</p>
        <button className="btn line sm" onClick={doLogout}><LogOut size={14} />로그아웃</button>
      </Card>

      <Card className="flat" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {user.officer_station_id ? (
          <p className="sub"><ShieldCheck size={14} style={{ verticalAlign: -2, marginRight: 4 }} />{user.officer_station_name} 소속({user.officer_rank})으로 인증된 계정입니다.</p>
        ) : (
          <p className="sub">경찰관이신가요? 신원 인증을 받으면 소속 경찰서 평가에 해명을 남길 수 있어요.</p>
        )}
        <Link href="/officer-verify" className="btn line sm">
          {user.officer_station_id ? '인증 정보 보기' : '경찰관 인증 신청'}
        </Link>
      </Card>

      <RegionFollows />

      <Card>
        <h2>내가 쓴 평가</h2>
        {error && <div className="warn">{error}</div>}
        <TableWrap>
          <table className="list">
            <thead>
              <tr><th>경찰서</th><th>구분</th><th>평점</th><th>추천</th><th>댓글</th><th>상태</th><th>작성일</th></tr>
            </thead>
            <tbody>
              {data && data.items.length ? (
                data.items.map((r) => {
                  const st = STATUS_LABEL[r.status];
                  return (
                    <tr key={r.id}>
                      <td><Link href={`/station/${r.station_id}`}>{r.station_name}</Link></td>
                      <td className="sub">{r.role_label} · {r.case_type_label}</td>
                      <td><Score value={r.overall} /></td>
                      <td className="sub">{r.score > 0 ? `+${r.score}` : r.score}</td>
                      <td className="sub">{r.comment_count}</td>
                      <td>
                        <span className={`badge ${st.tone}`}>{st.label}</span>
                        {r.evidence_verified && <span className="badge good"><ShieldCheck size={11} />증빙확인</span>}
                      </td>
                      <td className="sub">{formatDate(r.created_at)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={7} className="sub">아직 작성한 평가가 없습니다.</td></tr>
              )}
              {data && data.items.some((r) => r.status === 'rejected' && r.reject_reason) && (
                <tr><td colSpan={7}>
                  <div className="guidebox" style={{ marginBottom: 0 }}>
                    <b>반려 사유</b>
                    {data.items.filter((r) => r.status === 'rejected' && r.reject_reason).map((r) => (
                      <p key={r.id} className="sub" style={{ marginTop: 6 }}>{r.station_name}: {r.reject_reason}</p>
                    ))}
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </TableWrap>
        {totalPages > 1 && (
          <div className="btn-row" style={{ marginTop: 16, justifyContent: 'center' }}>
            <button className="btn line sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>이전</button>
            <span className="sub" style={{ alignSelf: 'center' }}>{page} / {totalPages}</span>
            <button className="btn line sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>다음</button>
          </div>
        )}
      </Card>
    </>
  );
}
