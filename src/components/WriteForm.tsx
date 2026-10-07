'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { BANNED } from '@/data/sample';
import { ApiError, submitReview, type ReviewRatingsIn } from '@/lib/api';

const CRITERIA: [keyof ReviewRatingsIn, string][] = [
  ['fair', '공정성·중립성'],
  ['proc', '절차 준수(권리 고지 등)'],
  ['att', '조사 태도'],
  ['comm', '소통·연락 응대'],
  ['speed', '신속성'],
];

const ROLE_OPTIONS: [string, string][] = [
  ['complainant', '고소인'], ['victim', '피해자'], ['suspect', '피의자'], ['witness', '참고인'], ['lawyer', '변호인'],
];
const CASE_TYPE_OPTIONS: [string, string][] = [
  ['fraud', '사기(경제)'], ['assault', '폭행·상해'], ['cyber', '사이버 범죄'], ['sexual', '성범죄'], ['traffic', '교통'], ['other', '기타'],
];

function StarPick({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="starpick">
      {[1, 2, 3, 4, 5].map((i) => (
        <button key={i} type="button" className={i <= value ? 'on' : ''} onClick={() => onChange(i)} aria-label={`${i}점`}>★</button>
      ))}
    </div>
  );
}

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 0) return '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.';
    if (e.status === 409) return '같은 사건번호로 이미 제출된 평가가 있습니다.';
    const detail = (e.body as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object' && 'message' in detail) return String((detail as { message: unknown }).message);
    return '입력값을 확인해 주세요.';
  }
  return '제출에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

export default function WriteForm({ stationId }: { stationId: number }) {
  const router = useRouter();
  const [role, setRole] = useState(ROLE_OPTIONS[0][0]);
  const [caseType, setCaseType] = useState(CASE_TYPE_OPTIONS[0][0]);
  const [caseNo, setCaseNo] = useState('');
  const [pick, setPick] = useState<Record<keyof ReviewRatingsIn, number>>({ fair: 0, proc: 0, att: 0, comm: 0, speed: 0 });
  const [text, setText] = useState('');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hit = BANNED.filter((b) => text.includes(b));

  const submit = async () => {
    if (hit.length) return;
    if (Object.values(pick).every((v) => v === 0)) {
      alert('별점 항목을 1개 이상 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await submitReview({
        station_id: stationId,
        role,
        case_type: caseType,
        case_number: caseNo.trim() || null,
        ratings: Object.fromEntries(Object.entries(pick).map(([k, v]) => [k, v || null])),
        body: text,
        evidence_note: evidenceNote.trim() || null,
      });
      setDone(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="form-section">1. 사건 정보</div>
      <div className="grid2" style={{ marginBottom: 0 }}>
        <div className="field">
          <label>사건에서의 지위</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div className="field">
          <label>사건 유형</label>
          <select value={caseType} onChange={(e) => setCaseType(e.target.value)}>
            {CASE_TYPE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>사건번호 <span className="tag">선택 · 비공개 · 경험 검증용</span></label>
        <input type="text" value={caseNo} onChange={(e) => setCaseNo(e.target.value)}
          placeholder="예: 2026-형제-00000 (입력하지 않아도 제출할 수 있습니다)" />
      </div>
      <div className="field">
        <label>증빙 자료 <span className="tag">선택 · 비공개</span></label>
        <input
          type="text" value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} maxLength={300}
          placeholder="예: 불기소 결정문 사본 보유 (운영진이 확인하면 '증빙확인' 배지가 붙습니다)"
        />
      </div>

      <div className="form-section">2. 항목별 평가</div>
      <div className="grid2" style={{ marginBottom: 0 }}>
        {CRITERIA.map(([k, label]) => (
          <div className="field" key={k}>
            <label>{label}</label>
            <StarPick value={pick[k]} onChange={(v) => setPick((p) => ({ ...p, [k]: v }))} />
          </div>
        ))}
      </div>

      <div className="form-section">3. 경험 서술 <span className="sub" style={{ fontWeight: 500 }}>(선택)</span></div>
      <div className="field">
        <textarea value={text} onChange={(e) => setText(e.target.value)}
          placeholder="직무수행과 관련하여 직접 경험한 사실을 구체적으로 작성해 주세요." />
        {hit.length > 0 && (
          <div className="warn">
            게시 불가 표현이 감지되었습니다: "{hit.join('", "')}". 인신공격·경멸적 표현은 모욕죄에 해당할 수 있으며 게시가 거부됩니다. 사실 중심으로 수정해 주세요.
          </div>
        )}
      </div>

      {error && <div className="warn">{error}</div>}
      <button className="btn lg" onClick={submit} disabled={submitting}>
        {submitting ? '게시 중…' : '게시하기'}
      </button>

      {done && (
        <div className="modal-ok">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 700 }}><CheckCircle2 size={20} />게시 완료</div>
          <p style={{ marginTop: 6 }}>
            작성하신 평가가 바로 게시되었습니다. 금칙어가 섞여 있으면 자동으로 거부되고, 그 외 문제가 있는 게시물은
            운영진이 사후에 조치합니다. 증빙 자료를 남겼다면 운영진 확인 후 "증빙확인" 배지가 붙습니다.
          </p>
          <hr className="divider" style={{ margin: '14px 0' }} />
          <p>비슷한 문제로 불편을 겪으셨다면 후기에서 멈추지 마세요.</p>
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn sm" onClick={() => router.push(`/remedy/${stationId}`)}>
              공식 민원·권리구제 절차로 <ArrowRight size={14} />
            </button>
            <button className="btn line sm" onClick={() => router.push(`/report/${stationId}`)}>
              특정 수사관 문제라면 언론·감독기관 제보로 <ArrowRight size={14} />
            </button>
          </div>
          <p className="sub" style={{ marginTop: 10 }}>
            개인 관련 상세 내용은 게시판이 아니라 검증 권한이 있는 곳으로 보내는 것이 안전하고 효과적입니다.
          </p>
        </div>
      )}
    </>
  );
}
