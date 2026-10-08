import type { Metadata } from 'next';
import { Suspense } from 'react';
import RemedyNavigator from '@/components/RemedyNavigator';

export const metadata: Metadata = {
  title: '권리구제 내비게이터',
  description:
    '겪은 문제 유형에 맞는 공식 권리구제 채널(국민신문고·기피신청·수사심의·인권위 진정 등)과 신청 방법을 안내합니다. ' +
    '상황별 맞춤 안내(절차 찾기)와 전체 절차 목록(전체 절차 보기)을 한 페이지에서 제공합니다.',
};

export default function RemedyPage() {
  return (
    <Suspense>
      <RemedyNavigator />
    </Suspense>
  );
}
