import type { Metadata } from 'next';
import type { ReactNode } from 'react';

export const metadata: Metadata = { title: '광고·제휴 문의', description: '폴리스맵 지역 타겟 광고와 제휴·비즈니스 문의.' };

export default function AdvertiseLayout({ children }: { children: ReactNode }) {
  return children;
}
