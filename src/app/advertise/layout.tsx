import type { Metadata } from 'next';
import { pageMeta } from '@/lib/seo';
import type { ReactNode } from 'react';

export const metadata: Metadata = pageMeta({ title: '광고·제휴 문의', description: '폴리스맵 지역 타겟 광고와 제휴·비즈니스 문의.', path: '/advertise' });

export default function AdvertiseLayout({ children }: { children: ReactNode }) {
  return children;
}
