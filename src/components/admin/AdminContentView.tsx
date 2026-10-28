'use client';

import { useEffect, useState } from 'react';
import { formatDate } from '@/lib/format';
import { getAdminContent, type AdminContent, type AdminContentKind } from '@/lib/api';

const RATING_LABEL: Record<string, string> = { fair: '공정성', proc: '절차 준수', att: '조사 태도', comm: '소통·응대', speed: '신속성' };
const STATUS_LABEL: Record<string, string> = {
  published: '공개', blinded: '블라인드', removed: '삭제', held: '보류', pending: '검수 대기', rejected: '반려',
};

/** 블라인드 목록·삭제·정정 요청에서 "원문 보기"로 펼치는 상자. 목록에는 앞부분만 보여서 판단할 수 없다는 의견(2026-10)으로,
 * 상태와 관계없이 원문 전체·평가 대상 실명·작성자를 관리자에게 보여 준다. */
export function AdminContentView({ kind, id }: { kind: AdminContentKind; id: number }) {
  const [data, setData] = useState<AdminContent | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    getAdminContent(kind, id).then((d) => { if (alive) setData(d); }).catch(() => { if (alive) setError(true); });
    return () => { alive = false; };
  }, [kind, id]);

  if (error) return <p className="sub">원문을 불러오지 못했습니다.</p>;
  if (!data) return <p className="sub">불러오는 중…</p>;
  const ratings = data.ratings ? Object.entries(data.ratings).filter(([, v]) => v !== null) : [];
  return (
    <div className="admin-content-view">
      <div className="acv-head">
        <b>{data.title}</b>
        <span className="badge">{STATUS_LABEL[data.status] ?? data.status}</span>
      </div>
      <p className="sub">
        작성자 {data.author}{data.created_at && ` · ${formatDate(data.created_at)}`}
        {data.meta.length > 0 && ` · ${data.meta.join(' · ')}`}
      </p>
      {ratings.length > 0 && (
        <p className="sub">{ratings.map(([k, v]) => `${RATING_LABEL[k] ?? k} ${v}`).join(' · ')}</p>
      )}
      <div className="acv-body">{data.body}</div>
      {data.sections.map((sec, i) => (
        <div key={i} className="acv-section">
          <span className="sub">{sec.label}</span>
          <div className="acv-body">{sec.text}</div>
        </div>
      ))}
    </div>
  );
}
