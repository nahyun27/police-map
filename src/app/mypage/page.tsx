'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { Card, PageHead, Score, TableWrap } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { ApiError, getMe, getMyReviews, logout, type MyReviewOut, type Page, type UserOut } from '@/lib/api';

const STATUS_LABEL: Record<MyReviewOut['status'], { label: string; tone: string }> = {
  pending: { label: '검수 대기', tone: 'mid' },
  published: { label: '게시됨', tone: 'good' },
  rejected: { label: '반려됨', tone: 'low' },
  blinded: { label: '임시조치', tone: 'mid' },
  removed: { label: '삭제됨', tone: 'low' },
};

const SIZE = 20;

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

      <Card>
        <h2>내가 쓴 평가</h2>
        {error && <div className="warn">{error}</div>}
        <TableWrap>
          <table className="list">
            <thead>
              <tr><th>경찰서</th><th>구분</th><th>평점</th><th>상태</th><th>작성일</th></tr>
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
                      <td><span className={`badge ${st.tone}`}>{st.label}</span></td>
                      <td className="sub">{formatDate(r.created_at)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr><td colSpan={5} className="sub">아직 작성한 평가가 없습니다.</td></tr>
              )}
              {data && data.items.some((r) => r.status === 'rejected' && r.reject_reason) && (
                <tr><td colSpan={5}>
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
