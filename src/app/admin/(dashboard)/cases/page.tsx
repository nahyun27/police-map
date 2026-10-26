'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<AdminCaseOut> | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 탭(상태)을 빠르게 바꾸면 이전 탭 요청이 늦게 도착해 지금 탭 목록을 덮어쓰던 문제를 막으려고,
  // 가장 최근 요청의 응답만 반영한다. 탭을 바꾸면 1쪽부터 다시 본다(다른 관리자 목록과 같은 방식).
  const seq = useRef(0);
  const load = useCallback(() => {
    const mySeq = ++seq.current;
    listAdminCases(status, page)
      .then((d) => { if (seq.current === mySeq) setData(d); })
      .catch(() => { if (seq.current === mySeq) setError('목록을 불러오지 못했습니다.'); });
  }, [status, page]);
  useEffect(() => { load(); }, [load]);
  const changeStatus = (v: string) => { setStatus(v); setPage(1); setData(null); setError(null); };
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

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
    <>
      <div className="admin-toolbar">
        <div className="seg">
          {STATUS_TABS.map(([v, l]) => (
            <button key={v} type="button" className={status === v ? 'active' : ''} onClick={() => changeStatus(v)}>{l}</button>
          ))}
        </div>
      </div>
      <Card>
        {error && <div className="warn" style={{ marginBottom: 16 }}>{error}</div>}

        <div>
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
          )) : <p className="sub admin-empty">{data ? '해당 상태의 사건이 없습니다.' : '불러오는 중…'}</p>}
        </div>
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
