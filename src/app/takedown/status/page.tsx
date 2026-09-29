import type { Metadata } from 'next';
import TakedownStatusLookup from '@/components/TakedownStatusLookup';
import { Card, Crumb, PageHead } from '@/components/ui';
import { NOINDEX } from '@/lib/seo';

export const metadata: Metadata = { title: '삭제·정정 요청 처리 현황', robots: NOINDEX };

export default function TakedownStatusEntryPage() {
  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: '삭제·정정 요청 처리 현황' }]} />
      <PageHead
        eyebrow="당사자 보호 절차"
        title="삭제·정정 요청 처리 현황 조회"
        sub="요청 접수 시 안내받은 코드로 현재 처리 상태를 확인할 수 있습니다."
      />
      <Card>
        <TakedownStatusLookup />
      </Card>
    </>
  );
}
