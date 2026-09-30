import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { Map, Scale, ShieldCheck, Star } from 'lucide-react';
import { Card, PageHead } from '@/components/ui';
import { getStats } from '@/lib/api';

// 기피신청 통계를 실시간으로 반영하므로 빌드 시점에 정적 생성하지 않는다.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '왜 폴리스맵인가',
  description: '수사의 실패는 언제나 있었습니다. 기록되지 않았을 뿐입니다 — 법원 판결과 국정조사로 이미 확인된 사건들의 기록.',
};

/**
 * 사건 카드 목록. 전부 법원 판결(재심 무죄·국가배상) 또는 국정조사·공식 조치로
 * 이미 확정된 사건만 담는다. 언론 보도만 있고 법원·국정조사 등 공식 확인이 없는
 * 사건은 의뢰인 확인 전까지 올리지 않는다(2026-09-30 결정).
 */
function WhyCase({ tag, title, refs, after, children }: { tag: string; title: string; refs: string; after: string; children: ReactNode }) {
  return (
    <Card>
      <span className="badge brand">{tag}</span>
      <h3 style={{ marginTop: 10 }}>{title}</h3>
      <p style={{ color: 'var(--ink2)', fontSize: 14 }}>{children}</p>
      <div className="guidebox" style={{ marginBottom: 0 }}>{after}</div>
      <p className="sub" style={{ marginTop: 10, fontSize: 12 }}>{refs}</p>
    </Card>
  );
}

const FEATURES = [
  { icon: Star, title: '경험자만, 사실만', body: '사건관계인·변호인이 사건서류로 검증받고 작성하는 5개 항목 구조화 평가. 비방·인신공격은 검수에서 걸러집니다.' },
  { icon: Map, title: '전국 경찰서', body: '관서·부서 단위의 평가와 통계를 지도로 봅니다. 특정 개인 낙인이 아닌, 패턴의 기록이 목적입니다.' },
  { icon: Scale, title: '평가에서 권리구제로', body: '불만으로 끝내지 않습니다. 국민신문고·수사관 기피신청·불송치 이의신청 등 공식 절차를 사안별로 안내합니다.' },
  { icon: ShieldCheck, title: '투명한 운영', body: '모든 게시물 선검수, 당사자 삭제·정정 요청 즉시 임시조치, 분기별 투명성 보고서 공개.' },
];

export default async function WhyPage() {
  const stats = await getStats();
  const latestAppeal = stats.appeals_filed.at(-1);

  return (
    <>
      <section className="card hero">
        <div className="eyebrow">POLICEMAP.KR — 국민이 만드는 수사 감시 플랫폼</div>
        <h1>수사의 실패는 언제나 있었습니다.<br /><em>기록되지 않았을 뿐입니다.</em></h1>
        <p className="lead">
          수사권 조정 이후 대부분의 사건은 경찰 단계에서 시작되고, 경찰 단계에서 끝납니다. 그러나 그 과정을 지켜보고
          기록하는 시민의 도구는 없었습니다. 아래는 법원 판결과 국정조사 등 공식 절차로 이미 확인된, 우리 모두가
          기억하는 실패의 기록입니다.
        </p>
      </section>

      <div className="grid2">
        {latestAppeal && (
          <Card className="kpi">
            <div className="num">{latestAppeal.value.toLocaleString()}건</div>
            <div className="lbl">연간 수사관 기피신청({latestAppeal.year}) — 5년 새 2배</div>
            <p className="sub" style={{ marginTop: 4 }}>2018년 2,425건 대비 · 언론 보도 종합</p>
          </Card>
        )}
        <Card className="kpi">
          <div className="num">3억 5천만 원</div>
          <div className="lbl">층간소음 흉기난동 부실대응 국가배상 판결</div>
          <p className="sub" style={{ marginTop: 4 }}>법원 판결 보도</p>
        </Card>
      </div>

      <PageHead
        eyebrow="Chapter 01 · 국민이 치른 대가"
        title="현장에서 물러선 경찰, 지켜지지 않은 신변보호"
      />
      <div className="grid2">
        <WhyCase tag="2021 · 인천" title="층간소음 흉기난동 — 현장을 이탈한 경찰"
          after={'경찰관 2명 해임. 2026년 6월 법원, 국가·경찰의 배상책임 인정(3억 5천만 원). "경찰 믿을 수 있나"라는 사회적 공분의 기점.'}
          refs="출처: 서울신문 2022.1.7, 연합뉴스·네이트뉴스 2026.6.21">
          층간소음 갈등 끝에 이웃이 흉기를 휘두르는 동안, 출동해 있던 <b>경찰관들이 현장을 이탈</b>해 피해자가 중상을 입었습니다.
          지원 요청도, 즉각 대응도 없었습니다.
        </WhyCase>
        <WhyCase tag="2021~2022 · 서울" title="신변보호 요청, 그 후의 살인들"
          after="스토킹처벌법 강화, 신변보호 시스템 개편의 계기가 되었습니다."
          refs="출처: 서울신문 2021.11.22, 위키백과·언론 보도 종합">
          신변보호를 받던 여성이 스마트워치로 두 차례 구조 신호를 보냈지만 위치 측정 실패로 살해됐고(중구), 신변보호 대상
          여성 대신 <b>그 가족이 보복 살해</b>당했으며(송파), 스토킹 피해를 고소했던 역무원은 신변보호가 연장되지 않은 채
          근무지에서 살해됐습니다(신당역, 2022). 세 사건 모두 "신고 이후"에 일어났습니다.
        </WhyCase>
        <WhyCase tag="2022 · 서울" title="이태원 참사 — 묵살된 11건의 112 신고"
          after="서울경찰청장 등 지휘부 기소, 용산경찰서장 유죄 판결. 국정조사·특별수사로 대응 체계 전반 개편."
          refs="출처: 국정조사 결과·언론 보도 종합">
          참사 당일 저녁, 압사 위험을 알리는 <b>112 신고 11건이 접수됐지만 실질적 조치는 이뤄지지 않았습니다.</b> 159명이
          희생됐고, 경찰 지휘부의 사전 대비·당일 대응 실패가 수사와 재판의 대상이 됐습니다.
        </WhyCase>
        <WhyCase tag="2012 · 수원" title="오원춘 사건 — 골든타임을 놓친 112"
          after="112 통합 시스템 개편, 위치추적 권한 확대 입법의 계기. 부실 대응 경찰관 다수 징계."
          refs="출처: 언론 보도 종합">
          납치된 피해자가 112에 전화해 위치를 설명하는 동안 <b>상담 요원은 정확한 위치를 파악하지 못했고, 현장 수색은
          엉뚱한 곳을 맴돌았습니다.</b> 피해자는 살해됐습니다. 112 신고 시스템의 구조적 한계가 전국민에게 드러난 사건입니다.
        </WhyCase>
      </div>

      <PageHead
        eyebrow="Chapter 02 · 조작과 은폐, 그리고 뒤늦은 무죄"
        title="잘못된 수사는 무고한 시민의 인생을 빼앗았습니다"
      />
      <div className="grid2">
        <WhyCase tag="1988→2020 · 화성" title="이춘재 8차 사건 — 20년을 빼앗긴 윤성여 씨"
          after="2020년 재심 무죄. 법원, 당시 경찰 수사의 위법성을 정면으로 인정."
          refs="출처: 재심 판결·언론 보도 종합">
          경찰의 <b>강압수사와 조작된 증거</b>로 무고한 시민이 살인범으로 몰려 20년을 복역했습니다. 진범 이춘재의 자백 후
          재심에서 무죄가 선고되기까지 32년이 걸렸습니다.
        </WhyCase>
        <WhyCase tag="2000→2016 · 익산" title="약촌오거리 사건 — 15살 소년의 10년"
          after="2016년 재심 무죄, 국가배상 판결. 영화 '재심'의 실화."
          refs="출처: 재심 판결·언론 보도 종합">
          택시기사 살인 사건에서 경찰은 <b>15세 소년을 폭행·협박해 허위 자백</b>을 받아냈고, 소년은 10년을 복역했습니다.
          진범이 검거될 기회도 수사기관이 스스로 덮었습니다.
        </WhyCase>
        <WhyCase tag="1999→2016 · 완주" title="삼례 나라슈퍼 사건 — 지적장애인 3인의 허위자백"
          after="2016년 재심 무죄, 국가배상 판결."
          refs="출처: 재심 판결·언론 보도 종합">
          강도치사 사건에서 경찰이 <b>지적장애가 있는 청년 3명에게 허위 자백을 강요</b>해 옥살이를 시켰습니다. 진범의
          자백이 있었음에도 수사는 바로잡히지 않았습니다.
        </WhyCase>
      </div>

      <Card>
        <div className="eyebrow">So, Policemap</div>
        <h2>처벌이 아니라 기록이 시스템을 바꿉니다</h2>
        <p className="sub" style={{ maxWidth: 720, marginBottom: 20 }}>
          위 사건들의 공통점은 하나입니다 — 문제가 커지기 전까지, 아무도 지켜보지 않았다는 것. 폴리스맵은 수사 절차를
          직접 경험한 시민의 구조화된 평가를 모아, 잘 하는 경찰에게는 신뢰를, 반복되는 문제에는 조기 경보를 만듭니다.
        </p>
        <div className="grid3">
          {FEATURES.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <div className="ico"><Icon size={22} /></div>
              <h3>{title}</h3>
              <p className="sub">{body}</p>
            </div>
          ))}
        </div>
      </Card>

      <section className="card hero compact" style={{ textAlign: 'center' }}>
        <h2>당신의 경험이 다음 실패를 막습니다</h2>
        <p className="lead" style={{ margin: '10px auto 22px' }}>좋았던 수사도, 아쉬웠던 수사도 — 기록해 주세요.</p>
        <div className="quick" style={{ justifyContent: 'center' }}>
          <Link href="/" className="btn gold">내 경찰서 찾아 평가하기</Link>
          <Link href="/remedy" className="btn ghost">권리구제 절차 알아보기</Link>
        </div>
      </section>

      <p className="sub" style={{ fontSize: 12, textAlign: 'center' }}>
        본 페이지의 사건 서술은 법원 판결(재심 무죄·국가배상)과 국정조사 등 공개된 자료에 근거한 사실의 기록이며, 각 항목에
        출처를 표시했습니다. 특정 개인에 대한 비방 목적이 아닌, 공공기관 직무수행의 투명성 제고라는 공익 목적으로
        작성되었습니다(형법 제310조). 피해자와 유족의 명예를 존중하며, 당사자의 요청이 있는 경우 지체 없이 검토·조치합니다.
      </p>
    </>
  );
}
