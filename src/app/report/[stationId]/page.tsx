import type { Metadata } from 'next';
import ReportPageBody from '@/components/ReportPageBody';
import { ApiError, getStation } from '@/lib/api';
import { NOINDEX } from '@/lib/seo';

// 백엔드의 실시간 데이터를 그리므로 빌드 시점에 정적 생성하지 않는다.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ stationId: string }> };

// 경찰서 맥락이 붙은 변형 페이지 — 색인 대상이 아니다(본 페이지는 /report).
export const metadata: Metadata = { title: '언론·감독기관 제보 안내', robots: NOINDEX };

export default async function ReportForStationPage({ params }: Props) {
  const { stationId } = await params;
  let stationName: string | undefined;
  try {
    const s = await getStation(stationId);
    stationName = s.name;
  } catch (e) {
    // 존재하지 않는 경찰서면 맥락 없이 일반 안내로 대체한다(에러로 막지 않는다).
    if (!(e instanceof ApiError && e.status === 404)) throw e;
  }
  return <ReportPageBody stationName={stationName} />;
}
