import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ClickableRow from '@/components/ClickableRow';
import RegionMiniMap from '@/components/RegionMiniMap';
import { Card, Crumb, PageHead, Score, TableWrap } from '@/components/ui';
import { ApiError, getRegion } from '@/lib/api';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const rg = await getRegion((await params).id);
    return {
      title: `${rg.full_name} 관할 경찰서 평가`,
      description: `${rg.full_name} 관할 경찰서 ${rg.station_count}곳의 수사 절차 평가와 공개정보.`,
    };
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

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: rg.full_name }]} />
      <PageHead
        eyebrow="시·도경찰청"
        title={rg.full_name}
        sub={`관할 경찰서 ${rg.station_count}개 · 평가 데이터는 관서 상세에서 확인할 수 있습니다.`}
      />
      {rg.hq_address && (
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
              <tr><th>경찰서</th><th>주소</th><th>수사부서</th><th>평균 평가</th></tr>
            </thead>
            <tbody>
              {rg.stations.length ? (
                rg.stations.map((s) => (
                  <ClickableRow key={s.id} href={`/station/${s.id}`}>
                    <td><Link href={`/station/${s.id}`}>{s.name}</Link></td>
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
