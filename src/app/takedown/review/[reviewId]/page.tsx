import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import TakedownForm from '@/components/TakedownForm';
import { Card, Crumb, PageHead } from '@/components/ui';
import { getReview } from '@/lib/api';
import { NOINDEX } from '@/lib/seo';

export const metadata: Metadata = { title: '삭제·정정 요청', robots: NOINDEX };

type Props = { params: Promise<{ reviewId: string }> };

export default async function TakedownReviewPage({ params }: Props) {
  const { reviewId } = await params;
  const id = Number(reviewId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  // 예전엔 ?station= 쿼리 글자를 그대로 제목에 넣어서, 누구나 링크에 아무 문구나 넣어 공식 안내처럼
  // 보이게 만들 수 있었다. 관서명은 서버에서 평가를 직접 조회해 쓰고, 못 가져오면(이미 블라인드된
  // 평가 등) 관서명 없는 일반 문구로 보여준다. 요청 접수 자체는 막지 않는다.
  let stationName: string | undefined;
  try {
    stationName = (await getReview(id)).station_name;
  } catch {
    stationName = undefined;
  }

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: '삭제·정정 요청' }]} />
      <PageHead
        eyebrow="당사자 보호 절차"
        title="평가 삭제·정정 요청"
        sub={
          stationName
            ? `${stationName}에 게시된 평가(#${id})에 대한 삭제 또는 정정을 요청합니다.`
            : `게시된 평가(#${id})에 대한 삭제 또는 정정을 요청합니다.`
        }
      />
      <Card className="tint">
        <p style={{ color: 'var(--ink2)' }}>
          게시물로 인하여 권리가 침해되었다고 주장하는 당사자는 침해 사실을 소명하여 삭제 또는 정정을 요청할 수 있습니다.
          접수 즉시 해당 게시물은 임시조치(블라인드)되며, 운영진이 10일 이내에 재검토합니다. 허위 신고는 다른 이용자의
          정당한 표현을 위축시킬 수 있으니 사실에 근거해 작성해 주세요.
        </p>
      </Card>
      <Card>
        <TakedownForm targetType="review" targetId={id} />
      </Card>
    </>
  );
}
