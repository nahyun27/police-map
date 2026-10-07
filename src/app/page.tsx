import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BarChart3, ChevronRight, Flame, Scale, ShieldCheck } from 'lucide-react';
import HeroSearch from '@/components/HeroSearch';
import KoreaMap from '@/components/KoreaMap';
import { MyRegionFeed } from '@/components/MyRegionFeed';
import { Bars, Card, Score, Stars, TableWrap } from '@/components/ui';
import { getPopularPosts, getRecentReviews, getRegions, getStats } from '@/lib/api';
import { formatDate } from '@/lib/format';

// 백엔드의 실시간 데이터를 그리므로 빌드 시점에 정적 생성하지 않는다.
export const dynamic = 'force-dynamic';

const FEATURES = [
  { to: '/policy', icon: ShieldCheck, title: '사실 기반 평가', body: '직무수행에 대한 구조화된 평가만 받습니다. 금칙어는 자동 필터링되고, 인신공격·사생활 게시물은 사후 삭제됩니다.', more: '운영원칙 보기' },
  { to: '/remedy', icon: Scale, title: '권리구제 내비게이터', body: '후기에서 멈추지 않도록, 겪은 문제에 맞는 공식 절차와 접수처를 안내합니다.', more: '내 상황에 맞는 절차 찾기' },
  { to: '/stats', icon: BarChart3, title: '공개 통계', body: '이용자 평가와 정보공개청구로 확보한 기피신청·수용률 통계를 함께 제공합니다.', more: '전국 통계 보기' },
];

// 법원 판결·국정조사로 이미 확정된 사건만 담는다(미확인 사건 제외, 2026-09-30 결정). 전문은 /why 참고.
const WHY_CASES = [
  { tag: '2021 · 인천', title: '층간소음 흉기난동, 현장을 이탈한 경찰', body: '출동해 있던 경찰관들이 현장을 이탈해 피해자가 중상. 2026년 6월 법원, 국가·경찰의 배상책임 인정(3억 5천만 원).' },
  { tag: '2022 · 서울', title: '이태원 참사, 묵살된 11건의 112 신고', body: '압사 위험을 알리는 112 신고 11건이 접수됐지만 실질적 조치는 없었습니다. 서울경찰청장 등 지휘부 기소, 용산경찰서장 유죄.' },
  { tag: '1988→2020 · 화성', title: '이춘재 8차 사건, 20년을 빼앗긴 윤성여 씨', body: '강압수사와 조작된 증거로 무고한 시민이 20년을 복역. 2020년 재심에서 무죄, 법원이 수사의 위법성을 인정했습니다.' },
];

export default async function Home() {
  const [regions, recent, stats, popularPosts] = await Promise.all([
    getRegions(), getRecentReviews(3), getStats(), getPopularPosts({ limit: 5 }),
  ]);

  return (
    <>
      <section className="card hero">
        <div className="eyebrow">국민 참여형 수사기관 평가 플랫폼</div>
        <h1>수사 절차의 투명성,<br /><em>국민이 만듭니다</em></h1>
        <p className="lead">
          전국 경찰관서·수사부서의 공개정보와 수사 절차를 직접 경험한 국민의 구조화된 평가를 한곳에 모았습니다.
          비방이 아닌 직무수행에 대한 사실 기반 평가, 그리고 권리구제 절차 안내를 제공합니다.
        </p>

        <HeroSearch />

        <div className="quick">
          <Link href="/why" className="btn gold sm">왜 폴리스맵인가</Link>
          <Link href="/remedy" className="btn ghost sm">권리구제 내비게이터 <ArrowRight size={14} /></Link>
          <Link href="/guide" className="btn ghost sm">기피신청 안내</Link>
          <Link href="/stats" className="btn ghost sm">전국 통계</Link>
        </div>

        <div className="hero-card" aria-hidden="true">
          <div className="hc-top"><i />평가 항목 미리보기</div>
          <div className="hc-title">OO경찰서</div>
          <div className="hc-score"><b>4.2</b><Stars value={4.2} /></div>
          <Bars rating={{ fair: 4.2, proc: 4.4, att: 4.0, comm: 3.8, speed: 4.1 }} />
        </div>

        <div className="hero-stats">
          <div><div className="num">{stats.totals.stations.toLocaleString()}</div><div className="lbl">등록 경찰서</div></div>
          <div><div className="num">{stats.totals.departments.toLocaleString()}</div><div className="lbl">등록 수사부서</div></div>
          <div><div className="num">{stats.totals.reviews.toLocaleString()}</div><div className="lbl">누적 평가</div></div>
        </div>
      </section>

      <MyRegionFeed />

      <div className="grid2">
        <Card>
          <h2>지도에서 찾기</h2>
          <p className="sub">시·도경찰청을 선택하면 관할 경찰서 목록으로 이동합니다.</p>
          <KoreaMap regions={regions} />
        </Card>

        <Card>
          <div className="sec-head">
            <div>
              <h2 style={{ marginBottom: 4 }}>최근 등록된 평가</h2>
              <p className="sub">모든 평가는 작성 즉시 게시됩니다. 금칙어는 자동으로 걸러집니다.</p>
            </div>
          </div>
          {recent.length ? recent.map((rv) => (
            <div className="review" key={rv.id}>
              <div className="meta">
                <span className="badge">{rv.role_label}</span>{rv.station_name} · {formatDate(rv.published_at)}
                {rv.evidence_verified && <span className="badge good"><ShieldCheck size={11} />증빙확인</span>}
              </div>
              <div className="head"><Score value={rv.overall} /></div>
              <p>
                {rv.body ? rv.body.slice(0, 78) + (rv.body.length > 78 ? '…' : '') : '(서술 없음, 별점만 등록)'}{' '}
                <Link href={`/station/${rv.station_id}`}>더보기</Link>
              </p>
            </div>
          )) : <p className="sub">아직 등록된 평가가 없습니다. 첫 평가의 주인공이 되어 주세요.</p>}
        </Card>
      </div>

      <Card>
        <div className="sec-head">
          <div>
            <h2 style={{ marginBottom: 4 }}><Flame size={18} style={{ verticalAlign: -3, marginRight: 4, color: 'var(--star)' }} />인기 게시글</h2>
            <p className="sub">최근 2주간 추천을 많이 받은 커뮤니티 글입니다.</p>
          </div>
          <Link href="/board" className="btn line sm">게시판 전체보기</Link>
        </div>
        {popularPosts.length ? (
          <TableWrap>
            <table className="list">
              <thead><tr><th>지역</th><th>제목</th><th>추천</th><th>댓글</th></tr></thead>
              <tbody>
                {popularPosts.map((p) => (
                  <tr key={p.id}>
                    <td className="sub">{p.region_name}</td>
                    <td><Link href={`/board/${p.id}`}>{p.title}</Link></td>
                    <td className="sub">{p.score}</td>
                    <td className="sub">{p.comment_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        ) : (
          <p className="sub">아직 추천받은 글이 없습니다. <Link href="/board/write">첫 글을 남겨 보세요</Link>.</p>
        )}
      </Card>

      <div className="grid3">
        {FEATURES.map(({ to, icon: Icon, title, body, more }) => (
          <Link key={to} href={to} className="card clickable-card feature">
            <div className="ico"><Icon size={22} /></div>
            <h3>{title}</h3>
            <p>{body}</p>
            <span className="more">{more} <ChevronRight size={15} /></span>
          </Link>
        ))}
      </div>

      <Card style={{ borderColor: '#f0c9c7', background: 'var(--low-soft)' }}>
        <div className="eyebrow" style={{ color: 'var(--low)' }}>왜 폴리스맵인가</div>
        <h2>기록되지 않은 실패는 반복됩니다</h2>
        <p className="sub" style={{ maxWidth: 720, marginBottom: 18 }}>
          아래 사건들의 공통점은 하나입니다. 문제가 커지기 전까지, 아무도 지켜보지 않았다는 것. 모두 법원 판결·국정조사로
          이미 확정된 기록입니다.
        </p>
        <div className="grid3">
          {WHY_CASES.map((c) => (
            <Link key={c.title} href="/why" className="card clickable-card" style={{ background: '#fff' }}>
              <span className="badge" style={{ background: '#fff', color: 'var(--low)', border: '1px solid #f0c9c7' }}>{c.tag}</span>
              <h3 style={{ marginTop: 10, fontSize: 15 }}>{c.title}</h3>
              <p className="sub" style={{ fontSize: 13 }}>{c.body}</p>
            </Link>
          ))}
        </div>
        <Link href="/why" className="btn ghost sm" style={{ marginTop: 18, borderColor: 'var(--low)', color: 'var(--low)' }}>
          전체 기록 보기: 왜 폴리스맵인가 <ArrowUpRight size={14} />
        </Link>
      </Card>

      <Card className="flat">
        <h3>공지</h3>
        <div className="notice">
          <div><em>안내</em>평가는 사건관계인·변호인만 작성할 수 있습니다.</div>
          <div><em>안내</em>당사자 삭제·정정 요청 창구를 운영합니다. 접수 즉시 임시조치됩니다.</div>
          <div><em>안내</em>경찰서 정보는 경찰청 전국경찰관서안내 공개자료를 기준으로 합니다.</div>
        </div>
      </Card>
    </>
  );
}
