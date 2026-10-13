'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, EyeOff, Eye, Trash2, X } from 'lucide-react';
import { Card, TableWrap } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { adminBlind, adminUnblind, listAdminReports, resolveReport, type AdminReportOut, type BlindableType, type Page } from '@/lib/api';

const STATUS_TABS: [string, string][] = [['pending', '처리 대기'], ['resolved', '처리 완료']];
const TARGET_LABEL: Record<AdminReportOut['target_type'], string> = {
  review: '평가', post: '게시글', review_comment: '평가 댓글', post_comment: '게시글 댓글', review_reply: '경찰관 해명',
  public_case: '사건 공론화',
};
const SIZE = 20;

export default function AdminReportsPage() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<AdminReportOut> | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actioningId, setActioningId] = useState<{ id: number; action: 'remove' | 'dismiss' } | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listAdminReports({ status, page, size: SIZE }).then(setData).catch(() => setError('목록을 불러오지 못했습니다.'));
  }, [status, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); setActioningId(null); setNote(''); }, [status]);

  const submitResolve = async (id: number, action: 'remove' | 'dismiss') => {
    if (note.trim().length < 5) return;
    setBusyId(id);
    setError(null);
    try {
      await resolveReport(id, action, note.trim());
      setActioningId(null);
      setNote('');
      await load();
    } catch { setError('처리에 실패했습니다.'); } finally { setBusyId(null); }
  };

  // 심각한 경우 신고 수와 상관없이 즉시 블라인드(평가·게시글·사건만 해당). 5명 이상 신고되면 자동으로 이미 블라인드돼 있다.
  const toggleBlind = async (r: AdminReportOut) => {
    const type = r.target_type as BlindableType;
    setBusyId(r.id);
    setError(null);
    try {
      if (r.target_blinded) await adminUnblind(type, r.target_id);
      else {
        const reason = prompt('블라인드 사유(작성자 마이페이지에 표시됩니다). 비우면 기본 문구가 들어갑니다.', '');
        if (reason === null) return;
        await adminBlind(type, r.target_id, reason.trim());
      }
      await load();
    } catch { setError('블라인드 처리에 실패했습니다.'); } finally { setBusyId(null); }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
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
              <th>대상</th><th>미리보기</th><th>신고자</th><th>신고 사유</th><th>접수일</th>
              {status === 'pending' && <th>처리</th>}
              {status === 'resolved' && <th>처리 결과</th>}
            </tr>
          </thead>
          <tbody>
            {data?.items.length ? data.items.map((r) => (
              <tr key={r.id}>
                <td>
                  {TARGET_LABEL[r.target_type] ?? r.target_type} #{r.target_id}
                  <div className="sub" style={{ marginTop: 4 }}>신고자 {r.pending_reporters}명</div>
                  {r.target_blinded && <span className="badge low" style={{ marginTop: 4 }}><EyeOff size={11} />블라인드됨</span>}
                </td>
                <td style={{ maxWidth: 240, whiteSpace: 'pre-wrap' }}>{r.target_preview}</td>
                <td className="sub">{r.reporter_nickname}</td>
                <td style={{ maxWidth: 220, whiteSpace: 'pre-wrap' }}>{r.reason}</td>
                <td className="sub" style={{ whiteSpace: 'nowrap' }}>{formatDate(r.created_at)}</td>
                {status === 'pending' && (
                  <td style={{ minWidth: 180 }}>
                    {actioningId?.id === r.id ? (
                      <div>
                        <p className="sub" style={{ marginBottom: 4 }}>{actioningId.action === 'remove' ? '삭제 조치' : '기각(그대로 둠)'}</p>
                        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="처리 메모(5자 이상)"
                          style={{ minHeight: 60, width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: 8, fontSize: 13 }} />
                        <div className="btn-row" style={{ marginTop: 6 }}>
                          <button className="btn sm" disabled={note.trim().length < 5 || busyId === r.id} onClick={() => submitResolve(r.id, actioningId.action)}>확정</button>
                          <button className="btn line sm" onClick={() => { setActioningId(null); setNote(''); }}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <div className="btn-row">
                        <button className="btn sm" disabled={busyId === r.id} onClick={() => { setActioningId({ id: r.id, action: 'remove' }); setNote(''); }}><Trash2 size={14} />삭제</button>
                        <button className="btn line sm" disabled={busyId === r.id} onClick={() => { setActioningId({ id: r.id, action: 'dismiss' }); setNote(''); }}><X size={14} />기각</button>
                        {r.target_blinded !== null && (
                          <button className="btn line sm danger" disabled={busyId === r.id} onClick={() => toggleBlind(r)}>
                            {r.target_blinded ? <><Eye size={14} />블라인드 해제</> : <><EyeOff size={14} />즉시 블라인드</>}
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                )}
                {status === 'resolved' && (
                  <td className="sub" style={{ maxWidth: 200 }}>
                    <span className={`badge ${r.resolution_action === 'removed' ? 'low' : 'mid'}`}>
                      {r.resolution_action === 'removed' ? <Check size={11} /> : <X size={11} />}
                      {r.resolution_action === 'removed' ? '삭제됨' : '기각됨'}
                    </span>
                    <p style={{ marginTop: 4 }}>{r.resolution_note}</p>
                  </td>
                )}
              </tr>
            )) : (
              <tr><td colSpan={6} className="sub">해당 상태의 신고가 없습니다.</td></tr>
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
