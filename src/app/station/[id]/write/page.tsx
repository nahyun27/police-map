import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import WriteForm from '@/components/WriteForm';
import { Card, Crumb, PageHead } from '@/components/ui';
import { ApiError, getStation } from '@/lib/api';
import { NOINDEX } from '@/lib/seo';

type Props = { params: Promise<{ id: string }> };

export const metadata: Metadata = { title: '평가 작성', robots: NOINDEX };

export default async function WritePage({ params }: Props) {
  const { id } = await params;
  let s;
  try {
    s = await getStation(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: s.name, to: `/station/${s.id}` }, { label: '평가 작성' }]} />
      <PageHead eyebrow={s.region.full_name} title={`${s.name} 평가 작성`} />

      <Card className="tint">
        <div style={{ display: 'flex', gap: 14 }}>
          <ShieldCheck size={22} style={{ color: 'var(--brand)', marginTop: 2 }} />
          <div>
            <h3 style={{ marginBottom: 8 }}>작성 전 꼭 읽어 주세요</h3>
            <ol style={{ paddingLeft: 18, color: 'var(--ink2)', fontSize: 14, display: 'grid', gap: 4 }}>
              <li>본인이 사건관계인(고소인·피해자·피의자·참고인) 또는 변호인으로 <b>직접 경험한 사실</b>만 작성해 주세요.</li>
              <li>
                직무수행과 관련된 내용으로 한정됩니다. 특정인 실명, 외모·사생활·인신공격 표현은 게시가 거부됩니다.
                특정 수사관에 대한 구체적 제보는 <Link href="/report" style={{ fontWeight: 700 }}>제보 안내</Link>를 이용하세요.
              </li>
              <li>허위사실 적시는 형사처벌(명예훼손) 대상이 될 수 있으며, 법적 분쟁 시 작성자가 책임을 부담합니다.</li>
              <li>모든 평가는 검수(24~48시간) 후 게시됩니다. <b>로그인 없이 작성할 수 있습니다.</b></li>
            </ol>
          </div>
        </div>
      </Card>

      <Card>
        <WriteForm stationId={s.id} />
      </Card>
    </>
  );
}
