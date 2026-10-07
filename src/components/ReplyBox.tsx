'use client';

import { useState } from 'react';
import { Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import { ApiError, createReply, deleteReply, updateReply, type ReplyOut } from '@/lib/api';
import { ReportButton } from '@/components/ReportButton';

/** 평가에 달리는 "경찰관 공식 해명" 블록. 표시는 모두에게 하되(reply 가 있으면), 새로 쓰는 건
 * canWrite(= 뷰어가 이 경찰서 소속으로 인증된 계정)일 때만, 해명이 아직 없을 때만 보여준다. */
export function ReplyBox({ reviewId, initialReply, canWrite }: { reviewId: number; initialReply: ReplyOut | null; canWrite: boolean }) {
  const [reply, setReply] = useState(initialReply);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(reply?.body ?? '');
  const [showName, setShowName] = useState(reply?.show_name ?? false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!reply && !canWrite) return null;

  const startEdit = () => {
    setBody(reply?.body ?? '');
    setShowName(reply?.show_name ?? false);
    setEditing(true);
    setError(null);
  };

  const submit = async () => {
    const text = body.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const r = reply ? await updateReply(reviewId, text, showName) : await createReply(reviewId, text, showName);
      setReply(r);
      setEditing(false);
    } catch (e) {
      if (e instanceof ApiError && e.status === 422) setError('게시할 수 없는 표현이 포함되어 있는지 확인해 주세요.');
      else setError('처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
    setBusy(false);
  };

  const remove = async () => {
    if (!confirm('이 해명을 삭제할까요?')) return;
    setBusy(true);
    setError(null);
    try {
      await deleteReply(reviewId);
      setReply(null);
    } catch {
      setError('삭제하지 못했습니다.');
    }
    setBusy(false);
  };

  return (
    <div className="reply-box">
      {reply && !editing && (
        <>
          <div className="reply-head">
            <ShieldCheck size={14} />{reply.author_label} 해명
            {reply.updated_at && <span className="sub">(수정됨)</span>}
          </div>
          <p>{reply.body}</p>
          <div className="btn-row">
            {reply.is_mine ? (
              <>
                <button type="button" className="link-btn" onClick={startEdit}><Pencil size={12} />수정</button>
                <button type="button" className="link-btn" onClick={remove} disabled={busy}><Trash2 size={12} />삭제</button>
              </>
            ) : (
              <ReportButton targetType="review_reply" targetId={reply.id} />
            )}
          </div>
        </>
      )}
      {(editing || (!reply && canWrite)) && (
        <div className="reply-form">
          {!reply && <div className="reply-head"><ShieldCheck size={14} />해명 작성</div>}
          <textarea
            value={body} onChange={(e) => setBody(e.target.value)} maxLength={2000}
            placeholder="사실관계·처리 경위 등을 중심으로 작성해 주세요."
          />
          <label className="sub reply-showname">
            <input type="checkbox" checked={showName} onChange={(e) => setShowName(e.target.checked)} />이름 공개
          </label>
          {error && <div className="warn">{error}</div>}
          <div className="btn-row">
            <button type="button" className="btn sm" onClick={submit} disabled={busy || !body.trim()}>
              {reply ? '수정 완료' : '해명 등록'}
            </button>
            {editing && <button type="button" className="btn line sm" onClick={() => setEditing(false)}>취소</button>}
          </div>
        </div>
      )}
    </div>
  );
}
