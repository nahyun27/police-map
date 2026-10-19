import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReviewDetail } from '@/components/ReviewDetail';
import { Card, Crumb } from '@/components/ui';
import { ApiError, getReview } from '@/lib/api';
import { NOINDEX } from '@/lib/seo';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const id = Number((await params).id);
    if (!Number.isInteger(id) || id <= 0) return {};
    const rv = await getReview(id);
    return { title: `${rv.station_name} 평가`, description: rv.body.slice(0, 100), robots: NOINDEX };
  } catch {
    return {};
  }
}

export default async function BoardReviewPage({ params }: Props) {
  const id = Number((await params).id);
  // 숫자가 아닌 주소는 백엔드가 422 를 줘서 에러 페이지가 떴다. 없는 페이지로 처리한다.
  if (!Number.isInteger(id) || id <= 0) notFound();
  let rv;
  try {
    rv = await getReview(id);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 422)) notFound();
    throw e;
  }

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: '커뮤니티 게시판', to: '/board' }, { label: `${rv.station_name} 평가` }]} />
      <Card>
        <ReviewDetail initial={rv} />
      </Card>
    </>
  );
}
