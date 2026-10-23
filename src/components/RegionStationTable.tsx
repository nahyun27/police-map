'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
import ClickableRow from '@/components/ClickableRow';
import { Score, TableWrap } from '@/components/ui';
import { stationKindLabel, type StationItem } from '@/lib/api';

/** 지역 상세의 관서 목록. 서울(31곳)·경기남부처럼 목록이 길어서 이름·주소로 바로 거를 수 있게 했다.
 * 목록 내용과 열은 이전 표와 같다(시·도경찰청 행이 맨 위). */
export function RegionStationTable({ stations }: { stations: StationItem[] }) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const t = q.trim();
    return t ? stations.filter((s) => s.name.includes(t) || (s.address ?? '').includes(t)) : stations;
  }, [q, stations]);

  return (
    <>
      <div className="region-table-head">
        <h2 style={{ marginBottom: 0 }}>관서 목록 <span className="sub" style={{ fontWeight: 500 }}>{stations.length}곳</span></h2>
        {stations.length > 6 && (
          <label className="hsearch region-filter">
            <Search size={16} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="관서 이름·주소로 찾기" aria-label="관서 이름·주소로 찾기" maxLength={30} />
          </label>
        )}
      </div>
      <TableWrap>
        <table className="list region-list">
          <thead>
            <tr><th>관서</th><th>주소</th><th>수사부서</th><th>평균 평가</th></tr>
          </thead>
          <tbody>
            {shown.length ? (
              shown.map((s) => (
                <ClickableRow key={s.id} href={`/station/${s.id}`}>
                  <td>
                    <Link href={`/station/${s.id}`}>{s.name}</Link>
                    {s.kind && s.kind !== 'station' && <span className="badge brand" style={{ marginLeft: 6 }}>{stationKindLabel(s.kind, s.name)}</span>}
                  </td>
                  <td className="sub" data-label="주소">{s.address ?? '-'}</td>
                  <td data-label="수사부서">{s.department_count ? `${s.department_count}개` : <span className="sub">-</span>}</td>
                  <td data-label="평균 평가"><Score value={s.rating.overall} /></td>
                </ClickableRow>
              ))
            ) : (
              <tr><td colSpan={4} className="sub">{stations.length ? '찾는 관서가 없습니다.' : '등록된 경찰서가 없습니다.'}</td></tr>
            )}
          </tbody>
        </table>
      </TableWrap>
    </>
  );
}
