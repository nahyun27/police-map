'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, EyeOff, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { adminBlind, approveCase, listAdminCases, removeCaseAdmin, type AdminCaseOut, type Page } from '@/lib/api';

const STATUS_TABS: [string, string][] = [['held', '보류(확인 필요)'], ['published', '공개'], ['blinded', '블라인드'], ['removed', '삭제']];

/** 사건 공론화 관리. 사전 검토 없이 즉시 공개가 원칙이지만, 개인정보·실명 노출 위험이 자동 탐지된
 * 글은 '보류'로 들어와 여기서 확인 후 공개하거나 삭제한다. */
export default function AdminCasesPage() {
  const [status, setStatus] = useState('held');
  const [data, setData] = useState<Page<AdminCaseOut> | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listAdminCases(status).then(setData).catch(() => setError('목록을 불러오지 못했습니다.'));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const run = async (id: number, fn: () => Promise<void>) => {
    setBusy(id);
    setError(null);
    try { await fn(); load(); } catch { setError('처리하지 못했습니다.'); } finally { setBusy(null); }
  };

  const remove = (c: AdminCaseOut) => {
    const reason = prompt('삭제 사유(5자 이상, 작성자 마이페이지에 표시됩니다)');
    if (!reason || reason.trim().length < 5) return;
    run(c.id, () => removeCaseAdmin(c.id, reason.trim()));
  };
  const blind = (c: AdminCaseOut) => {
    const reason = prompt('블라인드 사유(작성자 마이페이지에 표시됩니다). 비우면 기본 문구가 들어갑니다.', '');
    if (reason === null) return;
    run(c.id, () => adminBlind('public_case', c.id, reason.trim()));
  };

  return (
    <Card>
      <div className="seg">
        {STATUS_TABS.map(([v, l]) => (
          <button key={v} type="button" className={status === v ? 'active' : ''} onClick={() => setStatus(v)}>{l}</button>
        ))}
      </div>
      {error && <div className="warn" style={{ marginTop: 16 }}>{error}</div>}

      <div style={{ marginTop: 16 }}>
        {data?.items.length ? data.items.map((c) => (
          <div className="review" key={c.id}>
            <div className="meta">
              <span className="badge">{c.category_label}</span>
              {c.station_name && <span className="badge">{c.station_name}</span>}
              <span className="sub">#{c.id} · {c.author_nickname ?? '탈퇴 회원'} · {formatDate(c.created_at)} · 공감 {c.empathy_count} · 신고 {c.pending_reporters}명</span>
            </div>
            <h3 style={{ margin: '8px 0 6px' }}>
              {status === 'removed' ? c.title : <Link href={`/cases/${c.id}`} target="_blank">{c.title}</Link>}
            </h3>
            {c.hold_reason && <div className="warn" style={{ margin: '6px 0' }}>{c.hold_reason}</div>}
            {c.blind_reason && <p className="sub">블라인드 사유: {c.blind_reason}</p>}
            <p style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{c.body}</p>
            {c.desired_action && <p className="sub" style={{ marginTop: 6 }}>원하는 조치: {c.desired_action}</p>}
            {status !== 'removed' && (
              <div className="btn-row" style={{ marginTop: 10 }}>
                {status === 'held' && (
                  <button className="btn sm" disabled={busy === c.id} onClick={() => run(c.id, () => approveCase(c.id))}><Check size={14} />확인 후 공개</button>
                )}
                {status === 'published' && (
                  <button className="btn line sm danger" disabled={busy === c.id} onClick={() => blind(c)}><EyeOff size={14} />즉시 블라인드</button>
                )}
                <button className="btn line sm" disabled={busy === c.id} onClick={() => remove(c)}><Trash2 size={14} />삭제</button>
              </div>
            )}
          </div>
        )) : <p className="sub">{data ? '해당 상태의 사건이 없습니다.' : '불러오는 중…'}</p>}
      </div>
    </Card>
  );
}
