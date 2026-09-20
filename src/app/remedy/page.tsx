import type { Metadata } from 'next';
import RemedyNavigator from '@/components/RemedyNavigator';

export const metadata: Metadata = {
  title: '권리구제 내비게이터',
  description: '겪은 문제 유형에 맞는 공식 권리구제 채널(국민신문고·기피신청·수사심의·인권위 진정 등)과 신청 방법을 안내합니다.',
};

export default function RemedyPage() {
  return <RemedyNavigator />;
}
