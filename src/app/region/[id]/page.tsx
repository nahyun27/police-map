import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ClickableRow from '@/components/ClickableRow';
import { Card, Crumb, PageHead, Score, TableWrap } from '@/components/ui';
import { REGIONS, STATIONS, findRegion } from '@/data/sample';

type Props = { params: Promise<{ id: string }> };

export function generateStaticParams() {
  return REGIONS.map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const rg = findRegion((await params).id);
  if (!rg) return {};
  return {
    title: `${rg.full} 관할 경찰서 평가`,
    description: `${rg.full} 관할 경찰서 ${rg.stations}곳의 수사 절차 평가와 공개정보.`,
  };
}

export default async function RegionPage({ params }: Props) {
  const rg = findRegion((await params).id);
  if (!rg) notFound();
  const list = STATIONS.filter((s) => s.region === rg.id);

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: rg.full }]} />
      <PageHead
        eyebrow="시·도경찰청"
        title={rg.full}
        sub={`관할 경찰서 ${rg.stations}개 · 평가 데이터는 관서 → 부서 → 수사관 순으로 탐색할 수 있습니다.`}
      />
      <Card>
        <TableWrap>
          <table className="list">
            <thead>
              <tr><th>경찰서</th><th>수사부서</th><th>평균 평가</th><th>평가 수</th></tr>
            </thead>
            <tbody>
              {list.length ? (
                list.map((s) => (
                  <ClickableRow key={s.id} href={`/station/${s.id}`}>
                    <td><Link href={`/station/${s.id}`}>{s.name}</Link></td>
                    <td>{s.depts.length}개 부서</td>
                    <td><Score value={s.rating} /></td>
                    <td>{s.reviews}건</td>
                  </ClickableRow>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="sub">
                    데모에서는 이 지역 샘플 데이터가 없습니다. (실서비스: {rg.stations}개 관서)
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </>
  );
}
