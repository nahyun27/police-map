'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check, ShieldOff, X } from 'lucide-react';
import { Card, TableWrap } from '@/components/ui';
import { formatDate } from '@/lib/format';
import {
  approveVerification, listAdminVerifications, rejectVerification, revokeVerification,
  type AdminVerifyOut, type Page,
} from '@/lib/api';

const STATUS_TABS: [string, string][] = [['pending', '심사 대기'], ['approved', '인증됨'], ['rejected', '반려됨']];
const SIZE = 20;

export default function AdminOfficerVerificationsPage() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<AdminVerifyOut> | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actioningId, setActioningId] = useState<number | null>(null);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listAdminVerifications({ status, page, size: SIZE }).then(setData).catch(() => setError('목록을 불러오지 못했습니다.'));
  }, [status, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); setActioningId(null); setReason(''); }, [status]);

  const approve = async (id: number) => {
    setBusyId(id);
    setError(null);
    try { await approveVerification(id); await load(); } catch { setError('승인에 실패했습니다.'); } finally { setBusyId(null); }
  };

  const submitReject = async (id: number) => {
    if (reason.trim().length < 5) return;
    setBusyId(id);
    setError(null);
    try {
      await rejectVerification(id, reason.trim());
      setActioningId(null);
      setReason('');
      await load();
    } catch { setError('반려에 실패했습니다.'); } finally { setBusyId(null); }
  };

  const submitRevoke = async (id: number) => {
    if (reason.trim().length < 5) return;
    setBusyId(id);
    setError(null);
    try {
      await revokeVerification(id, reason.trim());
      setActioningId(null);
      setReason('');
      await load();
    } catch { setError('취소에 실패했습니다.'); } finally { setBusyId(null); }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

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
              <th>계정</th><th>경찰서</th><th>성명</th><th>계급</th><th>부서</th><th>연락처</th><th>확인 메모</th><th>신청일</th>
              {status === 'pending' && <th>처리</th>}
              {status === 'approved' && <th>처리</th>}
              {status === 'rejected' && <th>반려 사유</th>}
            </tr>
          </thead>
          <tbody>
            {data?.items.length ? data.items.map((v) => (
              <tr key={v.id}>
                <td className="sub">{v.user_nickname}<br />{v.user_email}</td>
                <td>{v.station_name}</td>
                <td>{v.name}</td>
                <td>{v.rank}</td>
                <td className="sub">{v.department ?? '-'}</td>
                <td className="sub">{v.contact}</td>
                <td className="sub" style={{ maxWidth: 200 }}>{v.proof_note ?? '-'}</td>
                <td className="sub" style={{ whiteSpace: 'nowrap' }}>{formatDate(v.created_at)}</td>
                {status === 'pending' && (
                  <td style={{ minWidth: 160 }}>
                    {actioningId === v.id ? (
                      <div>
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="반려 사유(5자 이상)"
                          style={{ minHeight: 60, width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: 8, fontSize: 13 }} />
                        <div className="btn-row" style={{ marginTop: 6 }}>
                          <button className="btn sm" disabled={reason.trim().length < 5 || busyId === v.id} onClick={() => submitReject(v.id)}>확정</button>
                          <button className="btn line sm" onClick={() => { setActioningId(null); setReason(''); }}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <div className="btn-row">
                        <button className="btn sm" disabled={busyId === v.id} onClick={() => approve(v.id)}><Check size={14} />승인</button>
                        <button className="btn line sm" disabled={busyId === v.id} onClick={() => setActioningId(v.id)}><X size={14} />반려</button>
                      </div>
                    )}
                  </td>
                )}
                {status === 'approved' && (
                  <td style={{ minWidth: 160 }}>
                    {actioningId === v.id ? (
                      <div>
                        <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="취소 사유(5자 이상)"
                          style={{ minHeight: 60, width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: 8, fontSize: 13 }} />
                        <div className="btn-row" style={{ marginTop: 6 }}>
                          <button className="btn sm" disabled={reason.trim().length < 5 || busyId === v.id} onClick={() => submitRevoke(v.id)}>취소 확정</button>
                          <button className="btn line sm" onClick={() => { setActioningId(null); setReason(''); }}>취소</button>
                        </div>
                      </div>
                    ) : (
                      <button className="btn line sm" disabled={busyId === v.id} onClick={() => setActioningId(v.id)}><ShieldOff size={14} />인증 취소</button>
                    )}
                  </td>
                )}
                {status === 'rejected' && <td className="sub" style={{ maxWidth: 200 }}>{v.reject_reason}</td>}
              </tr>
            )) : (
              <tr><td colSpan={9} className="sub">해당 상태의 신청이 없습니다.</td></tr>
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
