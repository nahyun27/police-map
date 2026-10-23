import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import RegionMiniMap from '@/components/RegionMiniMap';
import { RegionStationTable } from '@/components/RegionStationTable';
import { Card, Crumb, PageHead } from '@/components/ui';
import { ApiError, getRegion } from '@/lib/api';
import { pageMeta } from '@/lib/seo';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const rg = await getRegion((await params).id);
    const national = rg.id === 'national';
    const title = national ? '경찰청 본청·국가수사본부 평가' : `${rg.full_name} 관할 경찰서 평가`;
    const description = national
      ? '경찰청 본청과 국가수사본부 직속 수사부서에 대한 수사 평가·후기와 공개정보.'
      : `${rg.full_name}와 관할 경찰서 ${rg.station_count}곳의 수사 평가·후기와 공개정보. 지도에서 관할 경찰서를 찾고 평가를 비교해 보세요.`;
    return pageMeta({ title, description, path: `/region/${(await params).id}` });
  } catch {
    return {};
  }
}

export default async function RegionPage({ params }: Props) {
  const { id } = await params;
  let rg;
  try {
    rg = await getRegion(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  // "본청" 지역은 경찰청 본청·국가수사본부 두 기관만 담는 지역이라(지도에 없음) 문구를 따로 쓴다.
  const national = rg.id === 'national';
  // 시·도경찰청 자체도 직속 수사부서 평가 대상이라(2026-10) 목록 맨 위 행으로 들어와 있다. 있으면 본청 주소 카드는 생략.
  const hasAgencyRow = rg.stations.some((s) => s.kind && s.kind !== 'station');
  const agency = rg.stations.find((s) => s.kind === 'provincial');

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: rg.full_name }]} />
      <PageHead
        eyebrow={national ? '경찰청' : '시·도경찰청'}
        title={rg.full_name}
        sub={national
          ? '경찰청 본청과 국가수사본부 직속 수사부서를 평가할 수 있습니다.'
          : `${rg.full_name}와 관할 경찰서 ${rg.station_count}곳 · 평가 데이터는 관서 상세에서 확인할 수 있습니다.`}
      />
      {/* 디자인 정비 2단계: 지도와 요약(관서 수·평가 있는 곳·본청 주소)을 나란히, 목록은 이름·주소로 거를 수 있게. */}
      <div className="region-top">
        <RegionMiniMap regionId={id} stations={rg.stations} />
        <Card className="region-summary">
          <h2>한눈에 보기</h2>
          <dl>
            {!national && <div><dt>관할 경찰서</dt><dd>{rg.station_count}곳</dd></div>}
            <div><dt>평가가 있는 관서</dt><dd>{rg.stations.filter((s) => s.rating.count > 0).length}곳</dd></div>
            {hasAgencyRow && (national || agency) && (
              <div>
                <dt>{national ? '기관' : '시·도경찰청 직속 수사부서'}</dt>
                <dd>{national ? `${rg.stations.length}곳` : agency && <Link href={`/station/${agency.id}`}>{agency.department_count}개 →</Link>}</dd>
              </div>
            )}
          </dl>
          {rg.hq_address && (
            <p className="sub region-hq">
              본청 · {rg.hq_address}
              {rg.hq_website && <> · <a href={rg.hq_website} target="_blank" rel="noopener noreferrer">공식 홈페이지 ↗</a></>}
            </p>
          )}
        </Card>
      </div>
      <Card>
        <RegionStationTable stations={rg.stations} />
      </Card>
    </>
  );
}
