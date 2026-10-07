'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui';
import { getMyRegions, getRecentReviews, type RecentReview, type RegionFollowOut } from '@/lib/api';
import { formatDate } from '@/lib/format';

/** 로그인 + 관심 지역 등록 여부에 따라 결과가 갈리는 개인화 위젯이라, 서버 컴포넌트의
 * Node fetch 로는(브라우저 쿠키가 없어) 로그인 상태를 알 수 없다 — 클라이언트에서 직접 불러온다. */
export function MyRegionFeed() {
  const [regions, setRegions] = useState<RegionFollowOut[] | null>(null);
  const [reviews, setReviews] = useState<RecentReview[] | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyRegions()
      .then(async (regs) => {
        if (cancelled) return;
        setLoggedIn(true);
        setRegions(regs);
        if (regs.length) {
          const rv = await getRecentReviews(5, regs.map((r) => r.region_id));
          if (!cancelled) setReviews(rv);
        }
      })
      .catch(() => {
        // 401(비로그인)이든 다른 오류든 조용히 무시한다 — 홈 화면 전체를 방해하지 않기 위해,
        // 위젯을 그냥 숨긴다(loggedIn 이 기본값 false 로 남아 렌더링하지 않음).
      });
    return () => { cancelled = true; };
  }, []);

  if (!loggedIn || regions === null) return null;

  return (
    <Card>
      <div className="sec-head">
        <div>
          <h2 style={{ marginBottom: 4 }}>내 지역 소식</h2>
          <p className="sub">등록한 관심 지역에 새로 게시된 평가입니다.</p>
        </div>
      </div>
      {regions.length === 0 ? (
        <p className="sub">관심 지역을 등록하면 소식을 받아볼 수 있어요. <Link href="/mypage">관심 지역 등록하기</Link></p>
      ) : reviews === null ? (
        <p className="sub">불러오는 중…</p>
      ) : reviews.length === 0 ? (
        <p className="sub">아직 새로 게시된 평가가 없습니다.</p>
      ) : (
        reviews.map((rv) => (
          <div className="review" key={rv.id}>
            <div className="meta">
              <span className="badge">{rv.role_label}</span>{rv.station_name} · {formatDate(rv.published_at)}
            </div>
            <p>
              {rv.body ? rv.body.slice(0, 70) + (rv.body.length > 70 ? '…' : '') : '(서술 없음, 별점만 등록)'}{' '}
              <Link href={`/station/${rv.station_id}`}>더보기</Link>
            </p>
          </div>
        ))
      )}
    </Card>
  );
}
