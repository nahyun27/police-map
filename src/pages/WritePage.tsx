import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Crumb } from '../components/ui';
import { BANNED, findOfficer, findStation } from '../data/sample';
import type { Rating } from '../data/types';
import NotFound from './NotFound';

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

export default function WritePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const o = findOfficer(id);

  const [role, setRole] = useState('고소인');
  const [type, setType] = useState('사기(경제)');
  const [caseNo, setCaseNo] = useState('');
  const [pick, setPick] = useState<Rating>({ fair: 0, proc: 0, att: 0, comm: 0, speed: 0 });
  const [text, setText] = useState('');
  const [done, setDone] = useState(false);

  if (!o) return <NotFound />;
  const s = findStation(o.station)!;

  const hit = BANNED.filter((b) => text.includes(b));

  const submit = () => {
    if (hit.length) return;
    if (Object.values(pick).every((v) => v === 0)) {
      alert('별점 항목을 1개 이상 입력해 주세요.');
      return;
    }
    // TODO: 서버 연동 시 role/type/caseNo/pick/text 전송
    setDone(true);
  };

  return (
    <>
      <Crumb items={[{ label: `← ${o.name} ${o.rank} 프로필로`, to: `/officer/${o.id}` }]} />
      <Card>
        <h1>평가 작성</h1>
        <p className="sub">{s.name} {o.dept} · {o.name} {o.rank}</p>
        <div className="guidebox">
          <b>작성 가이드라인(필독)</b><br />
          ① 본인이 사건관계인(고소인·피해자·피의자·참고인) 또는 변호인으로 직접 경험한 사실만 작성해 주세요.<br />
          ② 직무수행과 관련된 내용으로 한정됩니다. 외모·사생활·인신공격 표현은 게시가 거부됩니다.<br />
          ③ 허위사실 적시는 형사처벌(명예훼손) 대상이 될 수 있으며, 법적 분쟁 시 작성자가 책임을 부담합니다.<br />
          ④ 모든 평가는 검수(24~48시간) 후 게시됩니다.
        </div>

        <div className="field">
          <label>본인 확인 <span className="tag">데모에서는 생략</span></label>
          <button className="btn line sm" onClick={() => alert('데모: 실서비스에서는 휴대폰 본인인증이 진행됩니다.')}>휴대폰 본인인증</button>
        </div>

        <div className="grid2">
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

        <div className="grid2">
          {CRITERIA.map(([k, label]) => (
            <div className="field" key={k}>
              <label>{label}</label>
              <StarPick value={pick[k]} onChange={(v) => setPick((p) => ({ ...p, [k]: v }))} />
            </div>
          ))}
        </div>

        <div className="field">
          <label>경험 서술(선택)</label>
          <textarea value={text} onChange={(e) => setText(e.target.value)}
            placeholder="직무수행과 관련하여 직접 경험한 사실을 구체적으로 작성해 주세요." />
          {hit.length > 0 && (
            <div className="warn">
              ⚠ 게시 불가 표현이 감지되었습니다: "{hit.join('", "')}" — 인신공격·경멸적 표현은 모욕죄에 해당할 수 있으며 게시가 거부됩니다. 사실 중심으로 수정해 주세요.
            </div>
          )}
        </div>

        <button className="btn" onClick={submit}>검수 요청(제출)</button>

        {done && (
          <div className="modal-ok">
            <b>제출 완료(데모)</b><br />
            작성하신 평가는 커뮤니티 가이드라인 적합성 검수(24~48시간) 후 게시됩니다. 부적합 판정 시 사유와 함께 반려됩니다.
            <hr className="divider" style={{ margin: '12px 0' }} />
            비슷한 문제로 불편을 겪으셨다면 후기에서 멈추지 마세요.<br />
            <button className="btn sm" style={{ marginTop: 8 }} onClick={() => navigate(`/remedy/${o.id}`)}>
              이 경험을 공식 민원으로 이어가기 → 권리구제 내비게이터
            </button>
          </div>
        )}
      </Card>
    </>
  );
}
