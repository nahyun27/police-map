import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ClickableRow from '@/components/ClickableRow';
import RegionMiniMap from '@/components/RegionMiniMap';
import { Card, Crumb, PageHead, Score, TableWrap } from '@/components/ui';
import { ApiError, getRegion, stationKindLabel } from '@/lib/api';
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
      {rg.hq_address && !hasAgencyRow && (
        <Card className="flat">
          <p className="sub">
            본청 · {rg.hq_address}
            {rg.hq_website && <> · <a href={rg.hq_website} target="_blank" rel="noopener noreferrer">공식 홈페이지 ↗</a></>}
          </p>
        </Card>
      )}
      <RegionMiniMap regionId={id} stations={rg.stations} />
      <Card>
        <TableWrap>
          <table className="list">
            <thead>
              <tr><th>관서</th><th>주소</th><th>수사부서</th><th>평균 평가</th></tr>
            </thead>
            <tbody>
              {rg.stations.length ? (
                rg.stations.map((s) => (
                  <ClickableRow key={s.id} href={`/station/${s.id}`}>
                    <td>
                      <Link href={`/station/${s.id}`}>{s.name}</Link>
                      {s.kind && s.kind !== 'station' && <span className="badge brand" style={{ marginLeft: 6 }}>{stationKindLabel(s.kind, s.name)}</span>}
                    </td>
                    <td className="sub">{s.address ?? '-'}</td>
                    <td>{s.department_count ? `${s.department_count}개` : <span className="sub">-</span>}</td>
                    <td><Score value={s.rating.overall} /></td>
                  </ClickableRow>
                ))
              ) : (
                <tr><td colSpan={4} className="sub">등록된 경찰서가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </>
  );
}
