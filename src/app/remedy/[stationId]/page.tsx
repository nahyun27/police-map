import type { Metadata } from 'next';
import RemedyNavigator from '@/components/RemedyNavigator';
import { ApiError, getStation } from '@/lib/api';
import { NOINDEX } from '@/lib/seo';

type Props = { params: Promise<{ stationId: string }> };

// 경찰서 맥락이 붙은 변형 페이지 — 색인 대상이 아니다(본 페이지는 /remedy).
export const metadata: Metadata = { title: '권리구제 내비게이터', robots: NOINDEX };

export default async function RemedyForStationPage({ params }: Props) {
  const { stationId } = await params;
  let contextLabel: string | undefined;
  let numericId: number | undefined;
  try {
    const s = await getStation(stationId);
    contextLabel = s.name;
    numericId = s.id;
  } catch (e) {
    // 존재하지 않는 경찰서면 맥락 없이 일반 내비게이터로 대체한다(에러로 막지 않는다).
    if (!(e instanceof ApiError && e.status === 404)) throw e;
  }
  return <RemedyNavigator contextLabel={contextLabel} stationId={numericId} />;
}
