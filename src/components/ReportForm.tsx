'use client';

import { useState } from 'react';
import { Copy, Download, FileText } from 'lucide-react';
import { REPORT_CATEGORIES } from '@/data/report';

function buildDraft(v: {
  category: string; station: string; when: string; body: string; evidence: string; contact: string;
}): string {
  return `[제보] ${v.category} — ${v.station || '관서 미기재'}

1. 제보 유형: ${v.category}
2. 관련 관서·부서: ${v.station || '(기재 요망)'}
3. 발생 시기: ${v.when || '(기재 요망)'}

4. 사건 개요 및 경위
${v.body || '(구체적 경위를 일시 순으로 기재해 주세요)'}

5. 보유 증거
${v.evidence || '(없으면 "없음"으로 기재)'}

6. 연락 방법
${v.contact || '비실명 제보를 원합니다.'}

※ 본 제보문은 제보자가 직접 작성한 것으로, 사실에 근거하여 작성하였음을 확인합니다.
※ 작성 지원: policemap.kr (내용 저장·전달 없음)`;
}

/** 이 컴포넌트는 어떤 값도 서버로 보내지 않는다 — 브라우저 안에서만 텍스트를 만들고, 복사·다운로드만 한다. */
export default function ReportForm({ stationName }: { stationName?: string }) {
  const [category, setCategory] = useState(REPORT_CATEGORIES[0]);
  const [station, setStation] = useState(stationName ?? '');
  const [when, setWhen] = useState('');
  const [body, setBody] = useState('');
  const [evidence, setEvidence] = useState('');
  const [contact, setContact] = useState('');
  const [draft, setDraft] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const generate = () => {
    setDraft(buildDraft({ category, station, when, body, evidence, contact }));
    setCopied(false);
  };

  const copy = async () => {
    if (!draft) return;
    try {
      await navigator.clipboard.writeText(draft);
    } catch {
      // 클립보드 API 가 막힌 환경(구형 브라우저·권한 거부)을 위한 대비. 실패해도 조용히 넘어간다.
    }
    setCopied(true);
  };

  const download = () => {
    if (!draft) return;
    const blob = new Blob([draft], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `제보문_${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <p className="sub">기자·조사관이 바로 검토할 수 있는 구조로 정리해 드립니다. 작성 후 복사해서 위 창구에 직접 제출하세요.</p>
      <div className="grid2" style={{ marginTop: 12, marginBottom: 0 }}>
        <div className="field">
          <label>제보 유형</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {REPORT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div className="field">
          <label>관련 관서</label>
          <input type="text" value={station} onChange={(e) => setStation(e.target.value)} placeholder="예: ○○경찰서 수사과" />
        </div>
      </div>
      <div className="field">
        <label>발생 시기</label>
        <input type="text" value={when} onChange={(e) => setWhen(e.target.value)} placeholder="예: 2026년 6월~8월" />
      </div>
      <div className="field">
        <label>사건 개요와 경위 <span className="tag">일시·장소·누가·무엇을 중심으로</span></label>
        <textarea value={body} onChange={(e) => setBody(e.target.value)}
          placeholder="예: 2026. 6. 고소장 접수 이후 담당 수사관이 3개월간 어떠한 조사도 진행하지 않았고, 진행상황 통지 요청에 대해 ..." />
      </div>
      <div className="field">
        <label>보유 증거 <span className="tag">목록만 — 파일은 제보처에 직접 제출</span></label>
        <input type="text" value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="예: 수사진행상황통지서 2건, 통화녹음 1건, 문자 캡처" />
      </div>
      <div className="field">
        <label>연락 방법 <span className="tag">제보처가 연락할 수단 — 비실명 원하면 비워두세요</span></label>
        <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="예: 이메일 또는 안전한 연락처" />
      </div>
      <button className="btn" onClick={generate}><FileText size={16} />제보문 생성</button>

      {draft && (
        <div style={{ marginTop: 16 }}>
          <div className="field" style={{ marginBottom: 0 }}>
            <textarea readOnly value={draft} style={{ minHeight: 220, fontFamily: 'inherit', fontSize: 13.5 }} />
          </div>
          <div className="btn-row" style={{ marginTop: 8 }}>
            <button className="btn sm" onClick={copy}><Copy size={14} />복사하기</button>
            <button className="btn line sm" onClick={download}><Download size={14} />파일로 저장</button>
            {copied && <span className="sub">복사되었습니다. 제보 창구에 붙여넣어 제출하세요.</span>}
          </div>
        </div>
      )}
    </>
  );
}
