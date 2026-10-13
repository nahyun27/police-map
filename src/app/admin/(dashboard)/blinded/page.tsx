'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye } from 'lucide-react';
import { Card, TableWrap } from '@/components/ui';
import { adminUnblind, listAdminBlinded, type BlindedItem } from '@/lib/api';

const TYPE_LABEL: Record<BlindedItem['target_type'], string> = { review: '평가', post: '게시글', public_case: '사건 공론화' };

// 평가는 블라인드되면 공개 API 에서 관리자에게도 안 보이므로 링크를 걸지 않는다(미리보기만).
function hrefOf(it: BlindedItem): string | null {
  if (it.target_type === 'post') return `/board/${it.target_id}`;
  if (it.target_type === 'public_case') return `/cases/${it.target_id}`;
  return null;
}

/** 현재 블라인드된 게시물 전체. 신고 누적 자동 블라인드와 관리자 수동 블라인드를 구분해 보여주고,
 * 문제가 없다고 판단되면 여기서 바로 해제한다(해제하면 작성자 마이페이지 표시도 함께 사라진다). */
export default function AdminBlindedPage() {
  const [items, setItems] = useState<BlindedItem[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    listAdminBlinded().then(setItems).catch(() => setError('목록을 불러오지 못했습니다.'));
  }, []);
  useEffect(() => { load(); }, [load]);

  const unblind = async (it: BlindedItem) => {
    if (!confirm('블라인드를 해제하고 다시 공개할까요? 남아 있는 신고는 신고 메뉴에서 따로 처리해 주세요.')) return;
    const key = `${it.target_type}-${it.target_id}`;
    setBusy(key);
    setError(null);
    try { await adminUnblind(it.target_type, it.target_id); load(); }
    catch { setError('해제하지 못했습니다.'); }
    finally { setBusy(null); }
  };

  return (
    <Card>
      <p className="sub" style={{ marginBottom: 12 }}>
        서로 다른 회원 5명 이상이 신고하면 자동으로 블라인드되고, 신고 메뉴에서 즉시 블라인드할 수도 있습니다.
        블라인드는 삭제가 아니라 공개만 멈춘 상태이며, 작성자에게는 마이페이지에서 사유가 보입니다.
      </p>
      {error && <div className="warn">{error}</div>}
      <TableWrap>
        <table className="list">
          <thead><tr><th>종류</th><th>내용</th><th>사유</th><th>남은 신고</th><th>처리</th></tr></thead>
          <tbody>
            {items?.length ? items.map((it) => {
              const href = hrefOf(it);
              const key = `${it.target_type}-${it.target_id}`;
              return (
                <tr key={key}>
                  <td style={{ whiteSpace: 'nowrap' }}>{TYPE_LABEL[it.target_type]} #{it.target_id}</td>
                  <td style={{ maxWidth: 280 }}>{href ? <Link href={href} target="_blank">{it.title}</Link> : it.title}</td>
                  <td style={{ maxWidth: 240 }}>
                    <span className={`badge ${it.is_auto ? 'mid' : 'low'}`}>{it.is_auto ? '신고 누적 자동' : '운영진·요청 조치'}</span>
                    <div className="sub" style={{ marginTop: 4 }}>{it.blind_reason}</div>
                  </td>
                  <td>{it.pending_reporters}명</td>
                  <td><button className="btn line sm" disabled={busy === key} onClick={() => unblind(it)}><Eye size={14} />해제</button></td>
                </tr>
              );
            }) : (
              <tr><td colSpan={5} className="sub">{items ? '블라인드된 게시물이 없습니다.' : '불러오는 중…'}</td></tr>
            )}
          </tbody>
        </table>
      </TableWrap>
    </Card>
  );
}
