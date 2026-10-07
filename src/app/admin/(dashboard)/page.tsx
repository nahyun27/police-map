'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ShieldCheck, Trash2, X } from 'lucide-react';
import { Card, TableWrap } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { approveReview, listAdminReviews, rejectReview, removeReview, setReviewEvidence, type AdminReview, type Page } from '@/lib/api';

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
    <Card>
      <div className="chips">
        {STATUS_TABS.map(([v, l]) => (
          <button key={v} className={`chip${status === v ? ' on' : ''}`} onClick={() => setStatus(v)}>{l}</button>
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
  );
}
