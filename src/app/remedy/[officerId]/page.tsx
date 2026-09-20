import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import RemedyNavigator from '@/components/RemedyNavigator';
import { OFFICERS, findOfficer, findStation } from '@/data/sample';
import { NOINDEX } from '@/lib/seo';

type Props = { params: Promise<{ officerId: string }> };

// 수사관 맥락이 붙은 변형 페이지 — 색인 대상이 아니다(본 페이지는 /remedy).
export const metadata: Metadata = { title: '권리구제 내비게이터', robots: NOINDEX };

export function generateStaticParams() {
  return OFFICERS.map((o) => ({ officerId: o.id }));
}

export default async function RemedyForOfficerPage({ params }: Props) {
  const o = findOfficer((await params).officerId);
  if (!o) notFound();
  const s = findStation(o.station)!;
  return <RemedyNavigator contextLabel={`${s.name} ${o.dept} ${o.name} ${o.rank}`} />;
}
