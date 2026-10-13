import Link from 'next/link';
import {
  ArrowRight, ArrowUpRight, BarChart3, ChevronRight, Flame, Megaphone, Scale, Search, ShieldCheck, Star,
  ThumbsDown, ThumbsUp,
} from 'lucide-react';
import HeroSearch from '@/components/HeroSearch';
import { MyRegionFeed } from '@/components/MyRegionFeed';
import RegionMapSwitcher from '@/components/RegionMapSwitcher';
import { Bars, Card, Score, Stars } from '@/components/ui';
import { getPopularPosts, getRecentReviews, getRegions, getStats, type StatsOverview } from '@/lib/api';
import { formatDate } from '@/lib/format';

// 여기서 쓰는 모든 fetch 가 이미 30~60초로 캐시돼 있으므로(src/lib/api.ts 의
// revalidateSeconds), force-dynamic 으로 매 요청마다 새로 렌더링해도 데이터 신선도는
// 똑같다 — 그 손해만 없애려고 가장 느슨한 캐시 주기(60초)에 맞춰 ISR 로 바꾼다.
export const revalidate = 60;

const FEATURES = [
  { to: '/policy', icon: ShieldCheck, title: '사실 기반 평가', body: '직무수행에 대한 구조화된 평가만 받습니다. 금칙어는 자동 필터링되고, 인신공격·사생활 게시물은 사후 삭제됩니다.', more: '운영원칙 보기' },
  { to: '/remedy', icon: Scale, title: '권리구제 내비게이터', body: '후기에서 멈추지 않도록, 겪은 문제에 맞는 공식 절차와 접수처를 안내합니다.', more: '내 상황에 맞는 절차 찾기' },
  { to: '/stats', icon: BarChart3, title: '공개 통계', body: '이용자 평가와 정보공개청구로 확보한 기피신청·수용률 통계를 함께 제공합니다.', more: '전국 통계 보기' },
];

// 메뉴가 검색·커뮤니티·소개·통계·권리구제·제보로 나뉘어 있어 처음 온 사람은 뭐부터
// 봐야 할지 헷갈릴 수 있다는 피드백(2026-10)으로, "기능 설명"이 아니라 "지금 뭐 하러
// 왔는지"를 바로 고르게 하는 진입 카드를 히어로 바로 아래에 둔다.
const PURPOSES = [
  { to: '#find-map', icon: Search, title: '경찰서 찾기', body: '관할 경찰서와 부서 확인' },
  { to: '/search?intent=write', icon: Star, title: '평가 바로 작성하기', body: '경찰서를 선택하고 바로 작성' },
  { to: '/remedy', icon: Scale, title: '권리구제 방법 찾기', body: '내 상황에 맞는 공식 절차' },
  { to: '/report', icon: Megaphone, title: '문제 제보하기', body: '감독기관·언론 제보 안내' },
];

// 법원 판결·국정조사로 이미 확정된 사건만 담는다(미확인 사건 제외, 2026-09-30 결정). 전문은 /why 참고.
const WHY_CASES = [
  { tag: '2021 · 인천', title: '층간소음 흉기난동, 현장을 이탈한 경찰', body: '출동해 있던 경찰관들이 현장을 이탈해 피해자가 중상. 2026년 6월 법원, 국가·경찰의 배상책임 인정(3억 5천만 원).' },
  { tag: '2026 · 제주', title: '장미란 실종사건, 허위 종결로 놓친 100일', body: '실종 신고 당일 밤 담당 경찰관이 "연락됐다"며 사건을 허위로 종결했습니다. 100여 일 만에 가족 재신고로 드러났을 땐 이미 숨진 뒤였고, 경찰관은 긴급체포됐습니다.' },
  { tag: '1988→2020 · 화성', title: '이춘재 8차 사건, 20년을 빼앗긴 윤성여 씨', body: '강압수사와 조작된 증거로 무고한 시민이 20년을 복역. 2020년 재심에서 무죄, 법원이 수사의 위법성을 인정했습니다.' },
];

const EMPTY_STATS: StatsOverview = {
  totals: { stations: 0, departments: 0, reviews: 0 },
  national: { fair: null, proc: null, att: null, comm: null, speed: null, overall: null, count: 0 },
  appeals_filed: [], appeal_acceptance_rate: null, station_ranking: [],
};

export default async function Home() {
  // 네 데이터 소스를 하나로 묶어 Promise.all 하면 하나만 실패해도 홈 전체가 크래시 화면으로
  // 떨어진다. 각자 독립적으로 실패를 흡수해서, 예컨대 통계 조회만 잠깐 안 되더라도 지도·최근
  // 평가·인기 게시글은 정상적으로 보이게 한다.
  const [regions, recent, stats, popularPosts] = await Promise.all([
    getRegions().catch(() => []),
    getRecentReviews(3).catch(() => []),
    getStats().catch(() => EMPTY_STATS),
    getPopularPosts({ limit: 5 }).catch(() => []),
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
          <Link href="/why" className="btn gold sm">폴리스맵 소개</Link>
          <Link href="/remedy" className="btn ghost sm">권리구제 내비게이터 <ArrowRight size={14} /></Link>
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

      <section className="purpose-section">
        <h2 className="purpose-title">어떤 도움이 필요하신가요?</h2>
        <div className="purpose-grid">
          {PURPOSES.map((p) => (
            <Link href={p.to} key={p.to} className="purpose-card">
              <div className="ico"><p.icon size={20} /></div>
              <b>{p.title}</b>
              <span className="sub">{p.body}</span>
            </Link>
          ))}
        </div>
      </section>

      <MyRegionFeed />

      <div className="grid2">
        <Card id="find-map">
          <h2>지도에서 찾기</h2>
          <p className="sub">시·도경찰청을 선택하면 관할 경찰서 목록으로 이동합니다.</p>
          <RegionMapSwitcher regions={regions} />
        </Card>

        {/* 오른쪽 칸: 공지 + 최근 평가. 평가가 아직 없을 땐 평가 카드가 내용만큼만 차지해서,
            왼쪽 지도 카드 높이를 빈 카드 하나로 억지로 채우지 않는다(2026-10). */}
        <div className="home-side">
          <Card className="home-notice">
            <h3>공지</h3>
            <div className="notice">
              <div><em>새 기능</em><span><Link href="/cases">사건 공론화</Link>가 열렸습니다. 수사 과정에서 겪은 일을 기록하고 공감을 모아 보세요.</span></div>
              <div><em>안내</em>평가는 사건관계인·변호인만 작성할 수 있습니다.</div>
              <div><em>안내</em>당사자 삭제·정정 요청 창구를 운영합니다. 접수 즉시 임시조치됩니다.</div>
              <div><em>안내</em>경찰서 정보는 경찰청 전국경찰관서안내 공개자료를 기준으로 합니다.</div>
            </div>
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
                {rv.evidence_verified && <span className="badge good" title="운영진이 증빙자료 제출 사실을 확인했다는 표시입니다. 서술 내용 전체의 사실 여부를 보증하지는 않습니다."><ShieldCheck size={11} />증빙확인</span>}
              </div>
              <div className="head"><Score value={rv.overall} /></div>
              <p>
                {rv.body ? rv.body.slice(0, 78) + (rv.body.length > 78 ? '…' : '') : '(서술 없음, 별점만 등록)'}{' '}
                <Link href={`/station/${rv.station_id}`}>더보기</Link>
              </p>
            </div>
          )) : (
            <>
              <p className="sub">아직 등록된 평가가 없습니다. 첫 평가의 주인공이 되어 주세요.</p>
              <Link href="/search?intent=write" className="btn sm" style={{ marginTop: 12 }}>첫 평가 작성하기</Link>
            </>
          )}
        </Card>
        </div>
      </div>

      <Card>
        <div className="sec-head">
          <div>
            <h2 style={{ marginBottom: 4 }}><Flame size={18} style={{ verticalAlign: -3, marginRight: 4, color: 'var(--star)' }} />인기 게시글</h2>
            <p className="sub">최근 일주일간 추천을 많이 받은 커뮤니티 글입니다.</p>
          </div>
          <Link href="/board" className="btn line sm">게시판 전체보기</Link>
        </div>
        {popularPosts.length ? (
          <div className="post-list">
            {popularPosts.map((p) => (
              <Link href={`/board/${p.id}`} key={p.id} className="post-row">
                <div className="post-row-top">
                  <span className="badge brand">{p.category_label}</span>
                  <span className="sub">{p.region_name ?? '전체'}</span>
                </div>
                <div className="post-row-title">{p.title}</div>
                <div className="post-row-meta sub">
                  <span className="stat"><ThumbsUp size={12} />{p.up}</span>
                  <span className="stat"><ThumbsDown size={12} />{p.down}</span>
                  <span>댓글 {p.comment_count}</span>
                </div>
              </Link>
            ))}
          </div>
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
          아래 사건들의 공통점은 하나입니다. 문제가 커지기 전까지, 아무도 지켜보지 않았다는 것. 모두 법원 판결·국정조사·수사기관의
          공식 조치로 이미 확인된 기록입니다.
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
          전체 기록 보기: 폴리스맵 소개 <ArrowUpRight size={14} />
        </Link>
      </Card>

    </>
  );
}
