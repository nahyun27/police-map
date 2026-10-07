'use client';

import { useState } from 'react';
import { Flag } from 'lucide-react';
import { ApiError, createReport, type ReportTargetType } from '@/lib/api';

/** 평가·게시글·댓글·해명 어디든 붙는 신고 버튼. 관리자 사후삭제와 별개로, 이용자가 직접
 * 문제를 지적해 관리자 신고 큐에 올리는 경로다. */
export function ReportButton({ targetType, targetId }: { targetType: ReportTargetType; targetId: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (done) return <span className="sub">신고 접수됨</span>;

  const submit = async () => {
    if (reason.trim().length < 5) return;
    setBusy(true);
    setError(null);
    try {
      await createReport(targetType, targetId, reason.trim());
      setDone(true);
      setOpen(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setError('로그인 후 신고할 수 있습니다.');
      else if (e instanceof ApiError && e.status === 409) setError('이미 신고 접수된 항목입니다.');
      else setError('신고 접수에 실패했습니다.');
    }
    setBusy(false);
  };

  return (
    <>
      <button type="button" className="link-btn" onClick={() => setOpen(!open)}><Flag size={12} />신고</button>
      {open && (
        <div className="cmt-form">
          <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="신고 사유(5자 이상)" maxLength={500} />
          <button type="button" className="btn sm" onClick={submit} disabled={busy || reason.trim().length < 5}>제출</button>
        </div>
      )}
      {error && <p className="warn">{error}</p>}
    </>
  );
}
