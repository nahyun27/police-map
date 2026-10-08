'use client';

import { useCallback, useEffect, useState } from 'react';
import { Card, TableWrap } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { listAuditLogs, type AuditLogOut, type Page } from '@/lib/api';

const SIZE = 50;

// 운영원칙에 적힌 "전 과정 기록 보존"을 실제로 확인할 수 있는 화면 — 관리자 조치는 전부
// AuditLog 에 쓰기 전용으로 쌓이는데, 지금까진 이걸 보여주는 화면이 없었다.
export default function AdminAuditLogPage() {
  const [action, setAction] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<AuditLogOut> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listAuditLogs({ action: action || undefined, page, size: SIZE }).then(setData).catch(() => setError('처리 기록을 불러오지 못했습니다.'));
  }, [action, page]);

  useEffect(() => { load(); }, [load]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <Card>
      <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
        <p className="sub">관리자 조치(검수·반려·삭제·인증 처리 등)가 기록되는 순서대로 쌓입니다. 수정·삭제는 불가능합니다.</p>
        <input
          className="sel" placeholder="action 값으로 필터(예: review_approved)" value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }} style={{ minWidth: 220 }}
        />
      </div>

      {error && <div className="warn">{error}</div>}

      <TableWrap>
        <table className="list">
          <thead>
            <tr><th>시각</th><th>처리자</th><th>조치</th><th>대상</th><th>상세</th></tr>
          </thead>
          <tbody>
            {data?.items.length ? data.items.map((a) => (
              <tr key={a.id}>
                <td className="sub" style={{ whiteSpace: 'nowrap' }}>{formatDate(a.created_at)}</td>
                <td className="sub">{a.actor_email ?? '(시스템)'}</td>
                <td><span className="badge brand">{a.action}</span></td>
                <td className="sub">{a.target_type} #{a.target_id ?? '-'}</td>
                <td className="sub" style={{ maxWidth: 320, whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: 12 }}>
                  {a.detail ? JSON.stringify(a.detail) : ''}
                </td>
              </tr>
            )) : (
              <tr><td colSpan={5} className="sub">기록이 없습니다.</td></tr>
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
