'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Check, ExternalLink, FileText, Lightbulb, Share2 } from 'lucide-react';
import { Card, TableWrap } from '@/components/ui';
import { REMEDY } from '@/data/sample';

const CHANNELS = [
  ['국민신문고', '태도·미통지 등 일반 민원', 'epeople.go.kr', '7~14일 내 처리·회신'],
  ['청문감사인권관', '비위·부당처리 상담, 기피 접수', '전국 각 경찰서', '수사부서와 분리 심사'],
  ['수사관 기피신청', '불공정 수사 염려', '청문감사(인권)담당관실', '수용 시 수사관 교체'],
  ['수사심의신청', '절차·결과의 적정성', '시·도경찰청 수사심의계', '심의 후 시정'],
  ['불송치 이의신청', '불송치 결정 불복', '해당 경찰서', '검찰 송치 효과'],
  ['인권위 진정', '조사 중 인권침해', '국가인권위 (1331)', '조사 후 권고'],
  ['권익위 신고', '부패·공익신고', '국민권익위', '신고자 보호 적용'],
  ['감찰 제보', '중대 비위', '경찰청·시도청 감찰', '감찰 조사'],
];

const BOARD: [string, number][] = [
  ['국민신문고 민원', 128], ['기피신청', 54], ['불송치 이의신청', 41], ['인권위 진정', 12],
];

/**
 * contextLabel: 특정 경찰서 페이지에서 넘어온 경우 그 경찰서명(표시용)
 * stationId: 위와 같은 경우 그 경찰서 id(제보 안내로 맥락을 이어가는 링크에 사용)
 */
export default function RemedyNavigator({ contextLabel, stationId }: { contextLabel?: string; stationId?: number }) {
  const [sel, setSel] = useState<string | null>(null);
  const r = REMEDY.find((x) => x.id === sel);

  return (
    <>
      <section className="card hero compact">
        <div className="eyebrow">민원 연계</div>
        <h1>권리구제 내비게이터</h1>
        <p className="lead">
          후기 작성에서 끝내지 마세요. 겪으신 문제 유형을 선택하면 국민신문고·기피신청 등 공식 권리구제 절차 중 맞는 채널과 신청 방법을 안내해 드립니다.
          폴리스맵은 절차 정보를 안내할 뿐, 민원 제출은 이용자 본인이 공식 창구에서 직접 진행합니다.
        </p>
      </section>

      <Card>
        <h2>어떤 문제를 겪으셨나요?</h2>
        {contextLabel && (
          <div className="guidebox" style={{ marginTop: 0 }}>
            선택된 맥락 · <b>{contextLabel}</b> 관련 경험을 바탕으로 안내합니다.
          </div>
        )}
        <div className="chips">
          {REMEDY.map((x) => (
            <button key={x.id} className={`chip${x.id === sel ? ' on' : ''}`} onClick={() => setSel(x.id)} aria-pressed={x.id === sel}>
              {x.q}
            </button>
          ))}
        </div>

        {r && (
          <div className="result">
            <span className="badge brand">추천 절차</span>
            <h2 style={{ marginTop: 8 }}>{r.ch}</h2>
            <div className="kv">
              <span className="badge">근거 · {r.base}</span>
              <span className="badge">접수처 · {r.to}</span>
            </div>
            <p style={{ color: 'var(--ink2)' }}>{r.how}</p>
            <div className="guidebox" style={{ display: 'flex', gap: 12 }}>
              <Lightbulb size={18} style={{ color: 'var(--mid)', marginTop: 3 }} />
              <div><b>실무 팁:</b> {r.tip}</div>
            </div>
            <div className="btn-row">
              <button className="btn"
                onClick={() => alert(`데모: 실서비스에서는 항목을 채우면 완성되는 자가 작성용 ${r.ch} 템플릿이 제공됩니다.\n(서류 작성·제출 대행이 아닌 정보 제공입니다)`)}>
                <FileText size={16} />서식 템플릿 열기
              </button>
              <button className="btn line" onClick={() => alert('데모: 실서비스에서는 공식 접수처(국민신문고 등) 링크로 이동합니다.')}>
                <ExternalLink size={16} />공식 접수처 바로가기
              </button>
              <button className="btn line" onClick={() => alert('데모: 진행 결과를 익명 통계로 공유하는 화면으로 이동합니다.')}>
                <Share2 size={16} />진행 결과 공유(익명)
              </button>
            </div>
            <p className="sub" style={{ marginTop: 16 }}>
              이 단계에서 변호사 조력이 필요하신가요? <Link href="/guide">변호사 광고 보기</Link> <span className="tag ad">광고</span>
            </p>
          </div>
        )}
      </Card>

      <Card>
        <h2>언론·감독기관에 알리고 싶은 사안인가요?</h2>
        <p className="sub">중대 비위나 구조적 문제는 민원보다 제보가 효과적일 수 있습니다.</p>
        <Link href={stationId ? `/report/${stationId}` : '/report'} className="btn line sm" style={{ marginTop: 8 }}>
          제보 안내 및 작성 도우미로 <ArrowRight size={14} />
        </Link>
      </Card>

      <Card>
        <h2>공식 채널 한눈에 보기</h2>
        <TableWrap>
          <table className="list">
            <thead><tr><th>채널</th><th>대상 사안</th><th>접수처</th><th>처리 특성</th></tr></thead>
            <tbody>
              {CHANNELS.map((c) => (
                <tr key={c[0]}>{c.map((v, i) => <td key={i}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>

      <div className="grid2">
        <Card>
          <h2>민원 진행 현황 보드 <span className="tag">익명 통계 · 샘플</span></h2>
          {BOARD.map(([k, v]) => (
            <div className="barrow" key={k}>
              <div className="lb" style={{ width: 120 }}>{k}</div>
              <div className="bar"><i style={{ width: `${(v / 128) * 100}%` }} /></div>
              <div className="vl" style={{ width: 44 }}>{v}건</div>
            </div>
          ))}
          <p className="sub" style={{ marginTop: 14 }}>
            이용자가 자발적으로 공유한 민원 진행 결과를 개인 식별 없이 관서·유형 단위로만 통계화합니다(샘플).
          </p>
        </Card>
        <Card className="tint">
          <h2>이용 전 꼭 확인하세요</h2>
          <ul className="checks">
            <li><Check size={16} /><span>허위 사실에 기초한 신고·고소는 <b>무고죄</b> 등 법적 책임이 발생할 수 있습니다. 사실에 근거해 작성하세요.</span></li>
            <li><Check size={16} /><span>폴리스맵이 제공하는 서식은 <b>자가 작성 지원용 안내 템플릿</b>이며, 서류 작성 대행·제출 대행은 하지 않습니다.</span></li>
            <li><Check size={16} /><span>본 안내는 일반적 법률정보로, 구체적 사안의 판단은 변호사 상담이 필요합니다.</span></li>
          </ul>
        </Card>
      </div>
    </>
  );
}
