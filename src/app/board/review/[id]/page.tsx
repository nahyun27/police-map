import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ReviewDetail } from '@/components/ReviewDetail';
import { Card, Crumb } from '@/components/ui';
import { ApiError, getReview } from '@/lib/api';
import { NOINDEX } from '@/lib/seo';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const rv = await getReview(Number((await params).id));
    return { title: `${rv.station_name} 평가`, description: rv.body.slice(0, 100), robots: NOINDEX };
  } catch {
    return {};
  }
}

export default async function BoardReviewPage({ params }: Props) {
  const id = Number((await params).id);
  let rv;
  try {
    rv = await getReview(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
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
