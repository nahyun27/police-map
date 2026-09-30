import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Bars, Card, Crumb, Score, Stars } from '@/components/ui';
import { ApiError, getStation } from '@/lib/api';
import { formatDate } from '@/lib/format';

// 백엔드의 실시간 데이터를 그리므로 빌드 시점에 정적 생성하지 않는다.
export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }>; searchParams: Promise<{ page?: string }> };

const PAGE_SIZE = 10;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const s = await getStation((await params).id);
    const ratingNote = s.rating.count ? `(평균 ${s.rating.overall?.toFixed(1)}점, ${s.rating.count}건)` : '';
    return { title: `${s.name} 수사 평가`, description: `${s.name}의 수사 절차 평가${ratingNote}와 수사부서 정보.` };
  } catch {
    return {};
  }
}

export default async function StationPage({ params, searchParams }: Props) {
  const { id } = await params;
  const page = Math.max(1, Number((await searchParams).page ?? '1') || 1);
  let s;
  try {
    s = await getStation(id, { page, size: PAGE_SIZE });
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
  const totalPages = Math.max(1, Math.ceil(s.reviews.total / s.reviews.size));

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: s.region.full_name, to: `/region/${s.region.id}` }, { label: s.name }]} />
      <Card>
        <div className="flex">
          <div className="grow">
            <div className="eyebrow">경찰서</div>
            <h1>{s.name}</h1>
            <p className="sub" style={{ marginTop: 8 }}>
              {s.address ?? '주소 정보 없음'}
              {s.website && <> · <a href={s.website} target="_blank" rel="noopener noreferrer">공식 홈페이지 ↗</a></>}
            </p>
          </div>
          <div className="bigscore">
            <div className="num">{s.rating.overall !== null ? s.rating.overall.toFixed(1) : '–'}</div>
            <div className="lbl"><Stars value={s.rating.overall} /> · 평가 {s.rating.count}건</div>
          </div>
        </div>
        <div className="btn-row" style={{ marginTop: 24 }}>
          <Link href={`/station/${s.id}/write`} className="btn">이 경찰서 평가 작성</Link>
          <Link href={`/remedy/${s.id}`} className="btn line">민원·권리구제 안내</Link>
          <Link href={`/report/${s.id}`} className="btn line">언론·기관 제보</Link>
        </div>
      </Card>

      <div className="grid2">
        <Card>
          <h2>평가 요약</h2>
          {s.rating.count ? (
            <>
              <Bars rating={s.rating} />
              <p className="sub" style={{ marginTop: 14 }}>항목: 공정성 / 절차 준수 / 조사 태도 / 소통·응대 / 신속성 (각 5점)</p>
            </>
          ) : (
            <p className="sub">아직 등록된 평가가 없습니다. 이 경찰서의 첫 평가를 남겨 주세요.</p>
          )}
        </Card>
        <Card className="tint">
          <h2>공개 정보 출처</h2>
          <p style={{ color: 'var(--ink2)' }}>{s.source ?? '경찰청 전국경찰관서안내 공개자료'}</p>
        </Card>
      </div>

      <Card>
        <h2>수사부서 <span className="tag">홈페이지 공개 기준</span></h2>
        {s.departments.length ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {s.departments.map((d) => <span key={d} className="badge">{d}</span>)}
          </div>
        ) : (
          <p className="sub">공개된 부서 정보가 없습니다.</p>
        )}
      </Card>

      <Card>
        <h2>평가 후기 <span className="sub" style={{ fontWeight: 500 }}>{s.reviews.total}건</span></h2>
        {s.reviews.items.length ? (
          s.reviews.items.map((rv) => (
            <div className="review" key={rv.id}>
              <div className="meta">
                <span className="badge brand">{rv.role_label}</span><span className="badge">{rv.case_type_label}</span>{formatDate(rv.published_at)} · 검수 완료
              </div>
              <div className="head"><Score value={rv.overall} /></div>
              <p>{rv.body || '(서술 없음, 별점만 등록)'}</p>
              <Link href={`/takedown/review/${rv.id}?station=${encodeURIComponent(s.name)}`} className="sub" style={{ display: 'inline-block', marginTop: 8 }}>
                이 게시물 삭제·정정 요청
              </Link>
            </div>
          ))
        ) : (
          <p className="sub">등록된 평가가 없습니다.</p>
        )}
        {totalPages > 1 && (
          <div className="btn-row" style={{ marginTop: 16, alignItems: 'center' }}>
            {page > 1 && <Link href={`/station/${s.id}?page=${page - 1}`} className="btn line sm">이전</Link>}
            <span className="sub">{page} / {totalPages}</span>
            {page < totalPages && <Link href={`/station/${s.id}?page=${page + 1}`} className="btn line sm">다음</Link>}
          </div>
        )}
      </Card>
    </>
  );
}
