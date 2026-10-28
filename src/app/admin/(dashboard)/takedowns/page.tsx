'use client';

import { Fragment, useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { AdminContentView } from '@/components/admin/AdminContentView';
import { Card, TableWrap } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { editTakedownNote, listAdminTakedowns, resolveTakedown, type AdminTakedown, type Page } from '@/lib/api';

const STATUS_TABS: [string, string][] = [['pending', '재검토 대기'], ['kept', '게시 유지'], ['removed', '삭제 확정']];
const SIZE = 20;
const TARGET_LABEL: Record<string, string> = { review: '평가', officer: '수사관 프로필', public_case: '사건 공론화' };
const REQUEST_LABEL: Record<string, string> = { delete: '삭제', correct: '정정' };

export default function AdminTakedownQueuePage() {
  const [status, setStatus] = useState('pending');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<AdminTakedown> | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [resolvingId, setResolvingId] = useState<number | null>(null);
  const [decision, setDecision] = useState<'keep' | 'remove'>('keep');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [noteDraft, setNoteDraft] = useState('');

  const load = useCallback(() => {
    listAdminTakedowns({ status, page, size: SIZE }).then(setData).catch(() => setError('목록을 불러오지 못했습니다.'));
  }, [status, page]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { setPage(1); }, [status]);

  const openResolve = (id: number, d: 'keep' | 'remove') => { setResolvingId(id); setDecision(d); setNote(''); };

  const submitResolve = async (id: number) => {
    if (note.trim().length < 5) return;
    setBusyId(id);
    setError(null);
    try {
      await resolveTakedown(id, decision, note.trim());
      setResolvingId(null);
      setNote('');
      await load();
    } catch { setError('처리에 실패했습니다.'); } finally { setBusyId(null); }
  };

  const saveNote = async (id: number) => {
    if (noteDraft.trim().length < 5) return;
    setBusyId(id);
    setError(null);
    try {
      await editTakedownNote(id, noteDraft.trim());
      setEditingNoteId(null);
      await load();
    } catch { setError('메모를 고치지 못했습니다.'); } finally { setBusyId(null); }
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  return (
    <>
      <div className="admin-toolbar">
        <div className="seg">
          {STATUS_TABS.map(([v, l]) => (
            <button key={v} type="button" className={status === v ? 'active' : ''} onClick={() => setStatus(v)}>{l}</button>
          ))}
        </div>
      </div>
      <Card>
        {error && <div className="warn" style={{ marginBottom: 16 }}>{error}</div>}

        <TableWrap>
          <table className="list">
            <thead>
              <tr>
                <th>대상</th><th>요청 유형</th><th>요청자</th><th>연락처</th><th>사유</th><th>접수일</th><th>기한</th>
                {status === 'pending' && <th>처리</th>}
                {status !== 'pending' && <th>처리 메모</th>}
              </tr>
            </thead>
            <tbody>
              {data?.items.length ? data.items.map((t) => {
                const targetId = t.review_id ?? t.case_id ?? t.officer_id;
                const open = openId === t.id;
                return (
                <Fragment key={t.id}>
                <tr>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    {TARGET_LABEL[t.target_type] ?? t.target_type} #{targetId}
                    {targetId !== null && (
                      <div>
                        <button type="button" className="acv-toggle" aria-expanded={open} onClick={() => setOpenId(open ? null : t.id)}>
                          {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}원문 {open ? '접기' : '보기'}
                        </button>
                      </div>
                    )}
                  </td>
                  <td>{REQUEST_LABEL[t.request_type] ?? t.request_type} · {t.relation}</td>
                  <td>{t.requester_name}</td>
                  <td className="sub">{t.requester_contact}</td>
                  <td style={{ maxWidth: 240, whiteSpace: 'pre-wrap' }}>{t.reason}</td>
                  <td className="sub" style={{ whiteSpace: 'nowrap' }}>{formatDate(t.created_at)}</td>
                  <td className="sub" style={{ whiteSpace: 'nowrap', color: t.overdue ? 'var(--low)' : undefined }}>
                    {formatDate(t.due_at)}{t.overdue && ' (초과)'}
                  </td>
                  {status === 'pending' && (
                    <td style={{ minWidth: 180 }}>
                      {resolvingId === t.id ? (
                        <div>
                          <p className="sub" style={{ marginBottom: 4 }}>{decision === 'keep' ? '게시 유지로 처리' : '삭제 확정으로 처리'}</p>
                          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="처리 메모(5자 이상). 요청인이 처리 상태 조회 화면에서 보게 됩니다."
                            style={{ minHeight: 60, width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: 8, fontSize: 13 }} />
                          <div className="btn-row" style={{ marginTop: 6 }}>
                            <button className="btn sm" disabled={note.trim().length < 5 || busyId === t.id} onClick={() => submitResolve(t.id)}>확정</button>
                            <button className="btn line sm" onClick={() => setResolvingId(null)}>취소</button>
                          </div>
                        </div>
                      ) : (
                        <div className="btn-row">
                          <button className="btn sm" disabled={busyId === t.id} onClick={() => openResolve(t.id, 'keep')}><ShieldCheck size={14} />게시 유지</button>
                          <button className="btn line sm" disabled={busyId === t.id} onClick={() => openResolve(t.id, 'remove')}><Trash2 size={14} />삭제 확정</button>
                        </div>
                      )}
                    </td>
                  )}
                  {status !== 'pending' && (
                    <td className="sub" style={{ minWidth: 200, maxWidth: 260 }}>
                      {editingNoteId === t.id ? (
                        <div>
                          <textarea value={noteDraft} onChange={(e) => setNoteDraft(e.target.value)} maxLength={2000}
                            style={{ minHeight: 70, width: '100%', border: '1px solid var(--line)', borderRadius: 8, padding: 8, fontSize: 13 }} />
                          <div className="btn-row" style={{ marginTop: 6 }}>
                            <button className="btn sm" disabled={noteDraft.trim().length < 5 || busyId === t.id} onClick={() => saveNote(t.id)}>저장</button>
                            <button className="btn line sm" onClick={() => setEditingNoteId(null)}>취소</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ whiteSpace: 'pre-wrap' }}>{t.resolution_note}</div>
                          <button type="button" className="acv-toggle" onClick={() => { setEditingNoteId(t.id); setNoteDraft(t.resolution_note ?? ''); }}>
                            <Pencil size={13} />메모 수정
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
                {open && targetId !== null && (
                  <tr className="admin-expand-row">
                    <td colSpan={8}><AdminContentView kind={t.target_type} id={targetId} /></td>
                  </tr>
                )}
                </Fragment>
                );
              }) : (
                <tr><td colSpan={8} className="sub">해당 상태의 요청이 없습니다.</td></tr>
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
