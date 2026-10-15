import type { Metadata } from 'next';
import TakedownForm from '@/components/TakedownForm';
import { Card, Crumb, PageHead } from '@/components/ui';
import { NOINDEX } from '@/lib/seo';

export const metadata: Metadata = { title: '삭제·정정 요청', robots: NOINDEX };

type Props = { params: Promise<{ officerId: string }> };

export default async function TakedownOfficerPage({ params }: Props) {
  const { officerId } = await params;
  const id = Number(officerId);

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: '삭제·정정 요청' }]} />
      <PageHead
        eyebrow="당사자 보호 절차"
        title="수사관 정보 삭제·정정 요청"
        sub={`평가 대상으로 등록된 수사관 정보(#${id})의 삭제 또는 정정을 요청합니다. 경찰관 본인이나 대리인이 요청할 수 있으며, 접수 즉시 이름이 비공개 처리됩니다.`}
      />
      <Card className="tint">
        <p style={{ color: 'var(--ink2)' }}>
          게시물로 인하여 권리가 침해되었다고 주장하는 당사자는 침해 사실을 소명하여 삭제 또는 정정을 요청할 수 있습니다.
          접수 즉시 해당 게시물은 임시조치(블라인드)되며, 운영진이 10일 이내에 재검토합니다. 허위 신고는 다른 이용자의
          정당한 표현을 위축시킬 수 있으니 사실에 근거해 작성해 주세요.
        </p>
      </Card>
      <Card>
        <TakedownForm targetType="officer" targetId={id} />
      </Card>
    </>
  );
}
