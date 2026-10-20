'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Check, Eye, ShieldCheck, ShieldPlus, Smartphone, Trash2, UserPlus, Users, X } from 'lucide-react';
import { Card, TableWrap } from '@/components/ui';
import { formatDate } from '@/lib/format';
import {
  approveReview, getAdminTraffic, getAdminUserStats, listAdminReviews, rejectReview, removeReview, setReviewEvidence,
  type AdminReview, type Page, type TrafficOut, type UserStatsOut,
} from '@/lib/api';

const STATUS_TABS: [string, string][] = [
  ['pending', '검수 대기(레거시)'], ['published', '게시됨'], ['rejected', '반려됨'], ['blinded', '임시조치'], ['removed', '삭제됨'],
];
const SIZE = 20;
// 2026-10 결정 이후 published/blinded 건은 관리자가 사후에 "삭제"할 수 있다(게시판 글 삭제와 동일한 성격).
const REMOVABLE = new Set(['published', 'blinded']);

function ratingSummary(r: AdminReview): string {
  const labels: Record<string, string> = { fair: '공정', proc: '절차', att: '태도', comm: '소통', speed: '신속' };
  return Object.entries(r.ratings)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => `${labels[k] ?? k} ${v}`)
    .join(' · ') || '-';
}

/** 방문 통계(자체 수집, 쿠키·외부 도구 없음). 방문자는 "날마다 서로 다른 사람 수"의 합이라, 같은 사람이 이틀 오면 2명으로 센다. */
function TrafficPanel() {
  const [t, setT] = useState<TrafficOut | null>(null);
  useEffect(() => { getAdminTraffic().then(setT).catch(() => {}); }, []);
  if (!t) return null;
  const max = Math.max(1, ...t.daily.map((d) => d.visitors));
  const kpi = (label: string, s: { visitors: number; pageviews: number }) => (
    <Card className="kpi stat flat">
      <div className="ico"><Eye size={19} /></div>
      <div>
        <div className="num">{s.visitors.toLocaleString()}</div>
        <div className="lbl">{label} 방문자 · 페이지뷰 {s.pageviews.toLocaleString()}</div>
      </div>
    </Card>
  );
  return (
    <Card>
      <h2><Activity size={17} style={{ verticalAlign: -3, marginRight: 5, color: 'var(--brand)' }} />방문 통계</h2>
      <div className="grid3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {kpi('오늘', t.today)}
        {kpi('어제', t.yesterday)}
        {kpi('최근 7일', t.last_7d)}
        {kpi('최근 30일', t.last_30d)}
      </div>
      <p className="sub" style={{ marginTop: 18, marginBottom: 8 }}>최근 14일 일별 방문자</p>
      <div className="admin-spark">
        {t.daily.map((d) => (
          <div key={d.day} className="admin-spark-bar" title={`${d.day} · 방문자 ${d.visitors}명 · 페이지뷰 ${d.pageviews}`}>
            <i style={{ height: `${Math.max(4, (d.visitors / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="grid2" style={{ marginTop: 18, marginBottom: 0 }}>
        <div>
          <p className="sub" style={{ marginBottom: 6 }}>많이 본 페이지(최근 7일)</p>
          {t.top_pages.length ? (
            <ol className="admin-rank">{t.top_pages.map(([p, n]) => <li key={p}><span>{p}</span><b>{n.toLocaleString()}</b></li>)}</ol>
          ) : <p className="sub">아직 기록이 없습니다.</p>}
        </div>
        <div>
          <p className="sub" style={{ marginBottom: 6 }}>
            들어온 경로(최근 7일) · <Smartphone size={12} style={{ verticalAlign: -1 }} /> 모바일 {Math.round(t.mobile_ratio * 100)}%
          </p>
          {t.top_referrers.length ? (
            <ol className="admin-rank">{t.top_referrers.map(([h, n]) => <li key={h}><span>{h}</span><b>{n.toLocaleString()}</b></li>)}</ol>
          ) : <p className="sub">외부 사이트에서 들어온 기록이 아직 없습니다(주소 직접 입력·즐겨찾기는 집계되지 않음).</p>}
        </div>
      </div>
    </Card>
  );
}

/** 가입 회원 현황. */
function UserStatsPanel() {
  const [stats, setStats] = useState<UserStatsOut | null>(null);

  useEffect(() => { getAdminUserStats().then(setStats).catch(() => {}); }, []);

  if (!stats) return null;
  const max = Math.max(1, ...stats.daily_signups.map(([, c]) => c));

  return (
    <Card>
      <h2><Users size={17} style={{ verticalAlign: -3, marginRight: 5, color: 'var(--brand)' }} />가입 회원 현황</h2>
      <div className="grid3">
        <Card className="kpi stat flat">
          <div className="ico"><Users size={19} /></div>
          <div><div className="num">{stats.total_users.toLocaleString()}</div><div className="lbl">전체 가입자</div></div>
        </Card>
        <Card className="kpi stat flat">
          <div className="ico"><UserPlus size={19} /></div>
          <div>
            <div className="num">{stats.new_7d.toLocaleString()}</div>
            <div className="lbl">최근 7일 신규 가입(30일 {stats.new_30d.toLocaleString()}명)</div>
          </div>
        </Card>
        <Card className="kpi stat flat">
          <div className="ico"><ShieldPlus size={19} /></div>
          <div><div className="num">{stats.officer_verified.toLocaleString()}</div><div className="lbl">경찰관 인증 완료</div></div>
        </Card>
      </div>
      <p className="sub" style={{ marginTop: 18, marginBottom: 8 }}>최근 14일 일별 가입</p>
      <div className="admin-spark">
        {stats.daily_signups.map(([day, count]) => (
          <div key={day} className="admin-spark-bar" title={`${day} · ${count}명`}>
            <i style={{ height: `${Math.max(4, (count / max) * 100)}%` }} />
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function AdminReviewQueuePage() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<AdminReview> | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actioningId, setActioningId] = useState<number | null>(null); // 반려/삭제 사유 입력 중인 행
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listAdminReviews({ status, page, size: SIZE }).then(setData).catch(() => setError('목록을 불러오지 못했습니다.'));
  }, [status, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); setActioningId(null); setReason(''); }, [status]);

  const approve = async (id: number) => {
    setBusyId(id);
    setError(null);
    try { await approveReview(id); await load(); } catch { setError('승인에 실패했습니다.'); } finally { setBusyId(null); }
  };

  const submitReject = async (id: number) => {
    if (reason.trim().length < 5) return;
    setBusyId(id);
    setError(null);
    try {
      await rejectReview(id, reason.trim());
      setActioningId(null);
      setReason('');
      await load();
    } catch { setError('반려에 실패했습니다.'); } finally { setBusyId(null); }
  };

  const submitRemove = async (id: number) => {
    if (reason.trim().length < 5) return;
    setBusyId(id);
    setError(null);
    try {
      await removeReview(id, reason.trim());
      setActioningId(null);
      setReason('');
      await load();
    } catch { setError('삭제에 실패했습니다.'); } finally { setBusyId(null); }
  };

  const toggleEvidence = async (r: AdminReview) => {
    setBusyId(r.id);
    setError(null);
    try { await setReviewEvidence(r.id, !r.evidence_verified); await load(); } catch { setError('증빙 확인 처리에 실패했습니다.'); } finally { setBusyId(null); }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const showAction = status === 'pending' || REMOVABLE.has(status);
  const showReason = status === 'rejected' || status === 'removed';
  const colCount = 7 + 1 + (showAction ? 1 : 0) + (showReason ? 1 : 0); // +1 은 증빙 열

  return (
    <>
      <TrafficPanel />
      <UserStatsPanel />
      <Card>
      <div className="seg">
        {STATUS_TABS.map(([v, l]) => (
          <button key={v} type="button" className={status === v ? 'active' : ''} onClick={() => setStatus(v)}>{l}</button>
        ))}
      </div>

      {error && <div className="warn" style={{ marginTop: 16 }}>{error}</div>}

      <TableWrap>
        <table className="list">
          <thead>
            <tr>
              <th>경찰서</th><th>지위</th><th>사건유형</th><th>평점</th><th>서술</th><th>사건번호</th><th>접수일</th>
              <th>증빙</th>
              {status === 'pending' && <th>검수 처리</th>}
              {REMOVABLE.has(status) && <th>사후 조치</th>}
              {status === 'rejected' && <th>반려 사유</th>}
              {status === 'removed' && <th>삭제 사유</th>}
            </tr>
          </thead>
          <tbody>
            {data?.items.length ? data.items.map((r) => (
              <tr key={r.id}>
                <td>{r.station_name}</td>
                <td>{r.role_label}</td>
                <td>{r.case_type_label}</td>
                <td className="sub">{ratingSummary(r)}</td>
                <td style={{ maxWidth: 260, whiteSpace: 'pre-wrap' }}>{r.body || '(서술 없음)'}</td>
                <td className="sub">{r.case_number ?? '-'}</td>
                <td className="sub" style={{ whiteSpace: 'nowrap' }}>{formatDate(r.created_at)}</td>
                <td style={{ minWidth: 150 }}>
                  <button
                    type="button" className={`btn sm ${r.evidence_verified ? '' : 'line'}`} disabled={busyId === r.id}
                    onClick={() => toggleEvidence(r)} title={r.evidence_note ?? '작성자가 남긴 증빙 메모 없음'}
                  >
                    <ShieldCheck size={14} />{r.evidence_verified ? '증빙확인됨' : '증빙확인'}
                  </button>
                </td>
                {status === 'pending' && (
                  <td style={{ minWidth: 160 }}>
                    {actioningId === r.id ? (
                      <div>
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="반려 사유(5자 이상)"
                          style={{ minHeight: 60, width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: 8, fontSize: 13 }} />
                        <div className="btn-row" style={{ marginTop: 6 }}>
                          <button className="btn sm" disabled={reason.trim().length < 5 || busyId === r.id} onClick={() => submitReject(r.id)}>확정</button>
                          <button className="btn line sm" onClick={() => { setActioningId(null); setReason(''); }}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <div className="btn-row">
                        <button className="btn sm" disabled={busyId === r.id} onClick={() => approve(r.id)}><Check size={14} />승인</button>
                        <button className="btn line sm" disabled={busyId === r.id} onClick={() => setActioningId(r.id)}><X size={14} />반려</button>
                      </div>
                    )}
                  </td>
                )}
                {REMOVABLE.has(status) && (
                  <td style={{ minWidth: 160 }}>
                    {actioningId === r.id ? (
                      <div>
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="삭제 사유(5자 이상)"
                          style={{ minHeight: 60, width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: 8, fontSize: 13 }} />
                        <div className="btn-row" style={{ marginTop: 6 }}>
                          <button className="btn sm" disabled={reason.trim().length < 5 || busyId === r.id} onClick={() => submitRemove(r.id)}>삭제 확정</button>
                          <button className="btn line sm" onClick={() => { setActioningId(null); setReason(''); }}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn line sm" disabled={busyId === r.id} onClick={() => setActioningId(r.id)}><Trash2 size={14} />삭제</button>
                    )}
                  </td>
                )}
                {status === 'rejected' && <td className="sub" style={{ maxWidth: 200 }}>{r.reject_reason}</td>}
                {status === 'removed' && <td className="sub" style={{ maxWidth: 200 }}>{r.reject_reason}</td>}
              </tr>
            )) : (
              <tr><td colSpan={colCount} className="sub">해당 상태의 평가가 없습니다.</td></tr>
            )}
          </tbody>
        </table>
      </TableWrap>

      {totalPages > 1 && (
        <div className="btn-row" style={{ marginTop: 16, alignItems: 'center' }}>
          {page > 1 && <button className="btn line sm" onClick={() => setPage((p) => p - 1)}>이전</button>}
          <span className="sub">{page} / {totalPages} ({data?.total}건)</span>
          {page < totalPages && <button className="btn line sm" onClick={() => setPage((p) => p + 1)}>다음</button>}
        </div>
      )}
      </Card>
    </>
  );
}
