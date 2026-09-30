import Link from 'next/link';
import { Landmark, Newspaper, ShieldAlert } from 'lucide-react';
import ReportForm from '@/components/ReportForm';
import { Card } from '@/components/ui';
import { OVERSIGHT_ORGS, PRESS_CHANNELS } from '@/data/report';

/** stationName 이 주어지면(경찰서 상세에서 넘어온 경우) 제보문 작성 도우미의 "관련 관서" 칸에 자동으로 채운다. */
export default function ReportPageBody({ stationName }: { stationName?: string }) {
  return (
    <>
      <section className="card hero compact">
        <div className="eyebrow">제보</div>
        <h1>언론·감독기관 제보 안내</h1>
        <p className="lead">
          폴리스맵은 관서 단위 평가만 게시합니다. <b>특정 수사관에 대한 구체적 문제</b>는 게시판에 쓰는 것보다, 검증 권한과 보호 제도를
          갖춘 언론·감독기관에 직접 제보하는 것이 더 안전하고 더 강력합니다. 폴리스맵은 아래에서 제보문 작성을 돕고 공식 창구로
          연결할 뿐, <b>제보 내용을 저장하거나 전달받지 않습니다.</b>
        </p>
      </section>

      {stationName && (
        <Card className="tint">
          <b>{stationName}</b> 관련 제보를 준비 중이시군요. 아래 작성 도우미의 "관련 관서"에 자동 입력됩니다.
        </Card>
      )}

      <Card style={{ borderLeft: '4px solid var(--gold)' }}>
        <div style={{ display: 'flex', gap: 12 }}>
          <ShieldAlert size={20} style={{ color: 'var(--mid)', marginTop: 2 }} />
          <div>
            <h2>먼저 확인하세요 — 어디에 제보해야 보호받나요?</h2>
            <p style={{ color: 'var(--ink2)' }}>
              <b>공익신고자 보호법의 보호(신분 비공개, 불이익조치 금지, 구조금 등)는 법이 정한 기관에 신고할 때 적용됩니다</b> —
              국민권익위원회, 수사기관, 국회의원 등이 이에 해당합니다. 언론사 제보는 공익적 효과가 크지만 동법의 보호 대상이 아닐 수
              있으므로, 신분 노출이 우려되면 ① 권익위 신고를 먼저 하거나 ② <b>변호사를 통한 비실명 대리신고 제도</b>(권익위)를
              이용하는 것이 안전합니다. 허위 사실에 기초한 신고는 무고죄 등 책임이 발생할 수 있습니다.
            </p>
          </div>
        </div>
      </Card>

      <div className="grid2">
        <Card>
          <h2><Landmark size={17} style={{ verticalAlign: -3, marginRight: 8, color: 'var(--brand)' }} />감독·신고 기관 <span className="tag">법정 보호</span></h2>
          {OVERSIGHT_ORGS.map((o) => (
            <div className="review" key={o.name}>
              <b>{o.name}</b>{o.tel && <span className="tag">{o.tel}</span>}
              <p className="sub" style={{ marginTop: 2 }}>{o.desc}</p>
              {o.url && <a href={o.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13 }}>공식 창구 바로가기 ↗</a>}
            </div>
          ))}
        </Card>
        <Card>
          <h2><Newspaper size={17} style={{ verticalAlign: -3, marginRight: 8, color: 'var(--brand)' }} />언론사 제보 창구</h2>
          {PRESS_CHANNELS.map((p) => (
            <div className="review" key={p.name}>
              <b>{p.name}</b>
              {p.desc && <p className="sub" style={{ marginTop: 2 }}>{p.desc}</p>}
              <p style={{ fontSize: 13, marginTop: p.desc ? 0 : 2 }}>
                <a href={p.url} target="_blank" rel="noopener noreferrer">바로가기 ↗</a>
                {p.email && <> · <a href={`mailto:${p.email}`}>{p.email}</a></>}
              </p>
            </div>
          ))}
          <p className="sub" style={{ marginTop: 10 }}>각 언론사의 제보 메뉴 위치는 변경될 수 있습니다. 제보 전 해당사의 제보자 보호 정책을 확인하세요.</p>
        </Card>
      </div>

      <Card>
        <h2>제보문 작성 도우미 <span className="tag">브라우저에서만 작성 · 서버 전송 없음</span></h2>
        <ReportForm stationName={stationName} />
      </Card>

      <p className="sub" style={{ textAlign: 'center' }}>
        평가 후기 작성이 더 맞는 상황이신가요? <Link href="/">경찰서 찾아 평가 작성하기</Link> · 공식 민원 절차는{' '}
        <Link href="/remedy">권리구제 내비게이터</Link>를 확인하세요.
      </p>
    </>
  );
}
