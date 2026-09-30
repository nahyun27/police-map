import type { Metadata } from 'next';
import ReportPageBody from '@/components/ReportPageBody';

export const metadata: Metadata = {
  title: '언론·감독기관 제보 안내',
  description: '경찰 관련 중대 비위·구조적 문제는 언론·감독기관에 직접 제보하는 것이 더 안전하고 강력할 수 있습니다. 공식 제보 창구 안내와 제보문 작성 도우미.',
};

export default function ReportPage() {
  return <ReportPageBody />;
}
