'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';
import { ApiError, submitTakedown, type TakedownCreatePayload } from '@/lib/api';

const RELATION_OPTIONS: TakedownCreatePayload['relation'][] = ['본인', '대리인', '기타'];

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
    if (e.status === 404) return '대상 게시물을 찾을 수 없습니다. 이미 삭제되었거나 잘못된 주소일 수 있습니다.';
    if (e.status === 429) return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
    return '입력값을 확인해 주세요.';
  }
  return '접수에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

export default function TakedownForm({ targetType, targetId }: { targetType: 'review' | 'officer'; targetId: number }) {
  const [requestType, setRequestType] = useState<TakedownCreatePayload['request_type']>('delete');
  const [relation, setRelation] = useState<TakedownCreatePayload['relation']>('본인');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<{ public_code: string; due_at: string } | null>(null);

  const canSubmit = name.trim().length >= 2 && contact.trim().length >= 5 && reason.trim().length >= 10;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      const r = await submitTakedown({
        target_type: targetType, target_id: targetId, request_type: requestType,
        requester_name: name.trim(), requester_contact: contact.trim(), relation, reason: reason.trim(),
      });
      setReceipt({ public_code: r.public_code, due_at: r.due_at });
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (receipt) {
    return (
      <div className="modal-ok">
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 700 }}><CheckCircle2 size={20} />접수 완료</div>
        <p style={{ marginTop: 6 }}>
          요청이 접수되었고 해당 게시물은 즉시 임시조치(블라인드)되었습니다. 10일 내 재검토 결과를 아래 접수 코드로 확인하실 수 있습니다.
        </p>
        <div className="guidebox" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>접수 코드: <b style={{ fontFamily: 'monospace', fontSize: 15 }}>{receipt.public_code}</b></span>
        </div>
        <Link href={`/takedown/status/${receipt.public_code}`} className="btn sm" style={{ marginTop: 10 }}>
          지금 처리 현황 보기
        </Link>
      </div>
    );
  }

  return (
    <>
      <div className="grid2" style={{ marginBottom: 0 }}>
        <div className="field">
          <label>요청 유형</label>
          <select value={requestType} onChange={(e) => setRequestType(e.target.value as TakedownCreatePayload['request_type'])}>
            <option value="delete">삭제 요청</option>
            <option value="correct">정정 요청</option>
          </select>
        </div>
        <div className="field">
          <label>게시물과의 관계</label>
          <select value={relation} onChange={(e) => setRelation(e.target.value as TakedownCreatePayload['relation'])}>
            {RELATION_OPTIONS.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="grid2" style={{ marginBottom: 0 }}>
        <div className="field">
          <label>성명(또는 기관명)</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 홍길동" />
        </div>
        <div className="field">
          <label>연락처 <span className="tag">처리 결과 통지용 · 비공개</span></label>
          <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="이메일 또는 전화번호" />
        </div>
      </div>
      <div className="field">
        <label>요청 사유</label>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="권리 침해 사실을 구체적으로 적어 주세요. (예: 해당 게시물은 본인이 담당하지 않은 사건에 관한 내용입니다.)" />
      </div>

      {error && <div className="warn">{error}</div>}
      <button className="btn lg" onClick={submit} disabled={!canSubmit || submitting}>
        {submitting ? '접수 중…' : '삭제·정정 요청 접수'}
      </button>
      <p className="sub" style={{ marginTop: 10 }}>접수 즉시 해당 게시물은 임시조치(블라인드)되며, 10일 이내 재검토 결과를 통지합니다.</p>
    </>
  );
}
