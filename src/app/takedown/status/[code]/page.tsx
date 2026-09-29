import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { Card, Crumb, PageHead } from '@/components/ui';
import { ApiError, getTakedownStatus } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { NOINDEX } from '@/lib/seo';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: '삭제·정정 요청 처리 현황', robots: NOINDEX };

const STATUS_LABEL: Record<string, string> = { pending: '재검토 대기', kept: '게시 유지 결정', removed: '삭제 확정' };
const STATUS_ICON: Record<string, typeof Clock> = { pending: Clock, kept: XCircle, removed: CheckCircle2 };
const REQUEST_TYPE_LABEL: Record<string, string> = { delete: '삭제 요청', correct: '정정 요청' };
const TARGET_TYPE_LABEL: Record<string, string> = { review: '평가 게시물', officer: '수사관 프로필' };

type Props = { params: Promise<{ code: string }> };

export default async function TakedownStatusPage({ params }: Props) {
  const { code } = await params;
  let s;
  try {
    s = await getTakedownStatus(code);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const Icon = STATUS_ICON[s.status] ?? Clock;

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: '처리 현황 조회', to: '/takedown/status' }, { label: s.public_code }]} />
      <PageHead eyebrow="당사자 보호 절차" title="삭제·정정 요청 처리 현황" />
      <Card>
        <div className="flex" style={{ justifyContent: 'space-between' }}>
          <div>
            <span className="badge brand">{STATUS_LABEL[s.status] ?? s.status}</span>
            <h2 style={{ marginTop: 10 }}>{TARGET_TYPE_LABEL[s.target_type] ?? s.target_type} · {REQUEST_TYPE_LABEL[s.request_type] ?? s.request_type}</h2>
          </div>
          <Icon size={28} style={{ color: 'var(--brand)' }} />
        </div>
        <div className="kv">
          <span className="badge">접수일 · {formatDate(s.created_at)}</span>
          <span className="badge">재검토 기한 · {formatDate(s.due_at)}</span>
        </div>
        {s.status === 'pending' ? (
          <div className="guidebox" style={{ marginBottom: 0 }}>
            운영진이 재검토 중입니다. 접수 즉시 대상 게시물은 임시조치(블라인드) 상태이며, 재검토 기한 내 결과를 이 페이지에서 다시 확인할 수 있습니다.
          </div>
        ) : (
          <div className="guidebox" style={{ marginBottom: 0 }}>
            <b>처리 결과</b> — {s.resolved_at && `${formatDate(s.resolved_at)} 처리 · `}
            {s.resolution_note ?? (s.status === 'kept' ? '재검토 결과 게시가 유지되었습니다.' : '재검토 결과 삭제가 확정되었습니다.')}
          </div>
        )}
      </Card>
    </>
  );
}
