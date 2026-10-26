'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { Card } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { listAdminInquiries, markInquiryDone, type AdminInquiry, type Page } from '@/lib/api';

/** 광고·제휴 문의함. 새 문의가 오면(SMTP 설정 시) 메일로도 알림이 간다. 답변은 남긴 연락처로 직접 한다. */
export default function AdminInquiriesPage() {
  const [status, setStatus] = useState<'new' | 'done'>('new');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<AdminInquiry> | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 탭(상태)을 빠르게 바꾸면 이전 탭 요청이 늦게 도착해 지금 탭 목록을 덮어쓰던 문제를 막으려고,
  // 가장 최근 요청의 응답만 반영한다. 탭을 바꾸면 1쪽부터 다시 본다(다른 관리자 목록과 같은 방식).
  const seq = useRef(0);
  const load = useCallback(() => {
    const mySeq = ++seq.current;
    listAdminInquiries(status, page)
      .then((d) => { if (seq.current === mySeq) setData(d); })
      .catch(() => { if (seq.current === mySeq) setError('목록을 불러오지 못했습니다.'); });
  }, [status, page]);
  useEffect(() => { load(); }, [load]);
  const changeStatus = (v: 'new' | 'done') => { setStatus(v); setPage(1); setData(null); setError(null); };
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  const done = async (q: AdminInquiry) => {
    const note = prompt('처리 메모(선택). 예: 단가표 메일 회신, 계약 진행 중');
    if (note === null) return;
    try { await markInquiryDone(q.id, note); load(); } catch { setError('처리하지 못했습니다.'); }
  };

  return (
    <>
      <div className="admin-toolbar">
        <div className="seg">
          <button type="button" className={status === 'new' ? 'active' : ''} onClick={() => changeStatus('new')}>새 문의</button>
          <button type="button" className={status === 'done' ? 'active' : ''} onClick={() => changeStatus('done')}>처리 완료</button>
        </div>
      </div>
      <Card>
        {error && <div className="warn" style={{ marginBottom: 12 }}>{error}</div>}
        <div>
          {data?.items.length ? data.items.map((q) => (
            <div className="review" key={q.id}>
              <div className="meta">
                <span className="badge brand">{q.inquiry_type_label}</span>
                {q.region_interest && <span className="badge">{q.region_interest}</span>}
                <span className="sub">{formatDate(q.created_at)}</span>
              </div>
              <b>{q.company}</b> <span className="sub">· {q.name} · {q.contact}</span>
              <p style={{ whiteSpace: 'pre-wrap', fontSize: 14, marginTop: 6 }}>{q.message}</p>
              {q.admin_note && <p className="sub" style={{ marginTop: 6 }}>메모: {q.admin_note}</p>}
              {q.status === 'new' && (
                <button className="btn sm" style={{ marginTop: 8 }} onClick={() => done(q)}><Check size={14} />처리 완료</button>
              )}
            </div>
          )) : <p className="sub admin-empty">{data ? '해당 문의가 없습니다.' : '불러오는 중…'}</p>}
        </div>
        {totalPages > 1 && (
          <div className="btn-row" style={{ marginTop: 16, alignItems: 'center' }}>
            {page > 1 && <button className="btn line sm" onClick={() => setPage((p) => p - 1)}>이전</button>}
            <span className="sub">{page} / {totalPages} ({data?.total}건)</span>
            {page < totalPages && <button className="btn line sm" onClick={() => setPage((p) => p + 1)}>다음</button>}
          </div>
        )}
      </Card>
    </>
  );
}
