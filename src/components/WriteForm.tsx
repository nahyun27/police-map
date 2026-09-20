'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { BANNED } from '@/data/sample';
import type { Rating } from '@/data/types';

const CRITERIA: [keyof Rating, string][] = [
  ['fair', '공정성·중립성'],
  ['proc', '절차 준수(권리 고지 등)'],
  ['att', '조사 태도'],
  ['comm', '소통·연락 응대'],
  ['speed', '신속성'],
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

export default function WriteForm({ officerId }: { officerId: string }) {
  const router = useRouter();
  const [role, setRole] = useState('고소인');
  const [type, setType] = useState('사기(경제)');
  const [caseNo, setCaseNo] = useState('');
  const [pick, setPick] = useState<Rating>({ fair: 0, proc: 0, att: 0, comm: 0, speed: 0 });
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);

  const hit = BANNED.filter((b) => text.includes(b));

  const submit = () => {
    if (hit.length) return;
    if (Object.values(pick).every((v) => v === 0)) {
      alert('별점 항목을 1개 이상 입력해 주세요.');
      return;
    }
    // TODO: 백엔드 연동 시 role/type/caseNo/pick/text 전송
    setDone(true);
  };

  return (
    <>
      <div className="form-section">1. 본인 확인 · 사건 정보</div>
      <div className="field">
        <label>본인 확인 <span className="tag">데모에서는 생략</span></label>
        <button className="btn line sm" onClick={() => alert('데모: 실서비스에서는 휴대폰 본인인증이 진행됩니다.')}>휴대폰 본인인증</button>
      </div>
      <div className="grid2" style={{ marginBottom: 0 }}>
        <div className="field">
          <label>사건에서의 지위</label>
          <select value={role} onChange={(e) => setRole(e.target.value)}>
            {['고소인', '피해자', '피의자', '참고인', '변호인'].map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="field">
          <label>사건 유형</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            {['사기(경제)', '폭행·상해', '사이버 범죄', '성범죄', '교통', '기타'].map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
      </div>
      <div className="field">
        <label>사건번호 <span className="tag">비공개 · 경험 검증용</span></label>
        <input type="text" value={caseNo} onChange={(e) => setCaseNo(e.target.value)}
          placeholder="예: 2026-형제-00000 (게시되지 않으며 검증에만 사용됩니다)" />
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
            게시 불가 표현이 감지되었습니다: "{hit.join('", "')}" — 인신공격·경멸적 표현은 모욕죄에 해당할 수 있으며 게시가 거부됩니다. 사실 중심으로 수정해 주세요.
          </div>
        )}
      </div>

      <button className="btn lg" onClick={submit}>검수 요청(제출)</button>

      {done && (
        <div className="modal-ok">
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 700 }}><CheckCircle2 size={20} />제출 완료(데모)</div>
          <p style={{ marginTop: 6 }}>작성하신 평가는 커뮤니티 가이드라인 적합성 검수(24~48시간) 후 게시됩니다. 부적합 판정 시 사유와 함께 반려됩니다.</p>
          <hr className="divider" style={{ margin: '14px 0' }} />
          <p>비슷한 문제로 불편을 겪으셨다면 후기에서 멈추지 마세요.</p>
          <button className="btn sm" style={{ marginTop: 10 }} onClick={() => router.push(`/remedy/${officerId}`)}>
            이 경험을 공식 민원으로 이어가기 <ArrowRight size={14} />
          </button>
        </div>
      )}
    </>
  );
}
