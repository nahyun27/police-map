'use client';

import { useCallback, useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { Card } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { listAdminInquiries, markInquiryDone, type AdminInquiry, type Page } from '@/lib/api';

/** 광고·제휴 문의함. 새 문의가 오면(SMTP 설정 시) 메일로도 알림이 간다. 답변은 남긴 연락처로 직접 한다. */
export default function AdminInquiriesPage() {
  const [status, setStatus] = useState<'new' | 'done'>('new');
  const [data, setData] = useState<Page<AdminInquiry> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listAdminInquiries(status).then(setData).catch(() => setError('목록을 불러오지 못했습니다.'));
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const done = async (q: AdminInquiry) => {
    const note = prompt('처리 메모(선택). 예: 단가표 메일 회신, 계약 진행 중');
    if (note === null) return;
    try { await markInquiryDone(q.id, note); load(); } catch { setError('처리하지 못했습니다.'); }
  };

  return (
    <Card>
      <div className="seg">
        <button type="button" className={status === 'new' ? 'active' : ''} onClick={() => setStatus('new')}>새 문의</button>
        <button type="button" className={status === 'done' ? 'active' : ''} onClick={() => setStatus('done')}>처리 완료</button>
      </div>
      {error && <div className="warn" style={{ marginTop: 12 }}>{error}</div>}
      <div style={{ marginTop: 16 }}>
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
        )) : <p className="sub">{data ? '해당 문의가 없습니다.' : '불러오는 중…'}</p>}
      </div>
    </Card>
  );
}
