import { useNavigate } from 'react-router-dom';
import { Card } from '../components/ui';

export default function GuidePage() {
  const navigate = useNavigate();

  return (
    <>
      <Card>
        <h1>수사 단계 권리구제 절차 안내</h1>
        <p className="sub">
          경찰 수사 과정에서 국민이 실제로 사용할 수 있는 공식 절차를 안내합니다.
          본 안내는 일반적 법률정보이며 구체적 사안은 변호사 상담이 필요합니다.
        </p>
      </Card>

      <Card>
        <h2>① 수사관 기피신청 (범죄수사규칙 제9조 등)</h2>
        <p>
          담당 수사관이 불공정한 수사를 하였거나 그러한 염려가 있다고 볼 객관적·구체적 사정이 있는 경우,
          피의자·피해자와 그 변호인은 수사관 교체를 신청할 수 있습니다.
        </p>
        <ol className="steps" style={{ marginTop: 14 }}>
          <li><b>기피신청서 작성</b> — 불공정 수사의 구체적 사정(일시·내용)을 기재합니다.</li>
          <li><b>해당 경찰서 청문감사(인권)담당관실 제출</b> — 수사부서가 아닌 감사부서가 심사합니다.</li>
          <li><b>수용 여부 결정·통보</b> — 수용 시 담당 수사관이 교체됩니다.</li>
        </ol>
        <div className="guidebox">
          실무 팁: 막연한 불만이 아니라 <b>구체적 사실(연락 두절 기간, 편파적 발언, 절차 위반 정황)</b>을 날짜와 함께 기재할수록 수용 가능성이 높습니다.
        </div>
      </Card>

      <Card>
        <h2>② 수사심의신청</h2>
        <p>수사 절차·결과의 적정성이 현저히 침해되었다고 판단되는 경우 시·도경찰청 수사심의계에 심의를 신청할 수 있습니다.</p>
        <h2 style={{ marginTop: 20 }}>③ 불송치 결정 이의신청 (형사소송법 제245조의7)</h2>
        <p>고소인 등은 경찰의 불송치 결정에 대해 해당 경찰서에 이의신청할 수 있고, 이 경우 사건은 검찰로 송치됩니다.</p>
        <h2 style={{ marginTop: 20 }}>④ 기타</h2>
        <p>국민신문고 민원, 국가인권위원회 진정(인권침해), 수사 이의제도 등을 사안에 따라 활용할 수 있습니다.</p>
        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={() => navigate('/remedy')}>내 상황에 맞는 절차 찾기 → 권리구제 내비게이터</button>
        </div>
      </Card>

      <div className="card" style={{ background: '#eef2f9' }}>
        <div>
          <h2>변호사의 도움이 필요하신가요?</h2>
          <p className="sub">
            아래 영역은 광고입니다. 폴리스맵은 특정 변호사를 알선·소개하지 않으며, 정액 광고료 외 어떠한 대가도 받지 않습니다.
          </p>
          <div className="grid2" style={{ marginTop: 10 }}>
            <Card><b>형사 전문 ○○○ 변호사</b> <span className="tag">광고</span><br /><span className="sub">수사 단계 대응 · 서울 (샘플 광고 슬롯)</span></Card>
            <Card><b>△△ 법률사무소</b> <span className="tag">광고</span><br /><span className="sub">고소대리 · 경기 (샘플 광고 슬롯)</span></Card>
          </div>
        </div>
      </div>
    </>
  );
}
