'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { Engagement } from '@/components/Engagement';
import { ReplyBox } from '@/components/ReplyBox';
import { Score } from '@/components/ui';
import { getMe, getReview, type RecentReview } from '@/lib/api';
import { formatDate } from '@/lib/format';

/** 게시판 "전체" 피드에서 평가를 눌렀을 때 보여주는 상세 — PostDetail 과 동일한 자리에서
 * 바로 댓글을 달 수 있게 하기 위한 것(2026-10 결정, 의뢰인 요청: "평가도 게시판에서 바로
 * 댓글 달 수 있게"). 댓글·추천 데이터는 경찰서 상세 페이지의 같은 평가와 완전히 같은 글
 * (review_id 기준)이라, 어느 쪽에서 남겨도 양쪽에 동일하게 보인다. */
export function ReviewDetail({ initial }: { initial: RecentReview }) {
  const [rv, setRv] = useState(initial);
  const [canReply, setCanReply] = useState(false);

  useEffect(() => {
    getReview(initial.id).then(setRv).catch(() => {});
    getMe().then((me) => setCanReply(me.officer_station_id === initial.station_id)).catch(() => {});
  }, [initial.id, initial.station_id]);

  return (
    <>
      <div className="flex" style={{ gap: 8, marginBottom: 12 }}>
        <Link href={`/station/${rv.station_id}`} className="eyebrow" style={{ marginBottom: 0 }}>{rv.station_name}</Link>
        <span className="badge cat-review">평가</span>
      </div>
      <div className="meta">
        <span className="badge brand">{rv.role_label}</span><span className="badge">{rv.case_type_label}</span>{formatDate(rv.published_at)}
        {rv.evidence_verified && (
          <span className="badge good" title="운영진이 증빙자료 제출 사실을 확인했다는 표시입니다. 서술 내용 전체의 사실 여부를 보증하지는 않습니다.">
            <ShieldCheck size={11} />증빙확인
          </span>
        )}
      </div>
      <div className="head" style={{ marginTop: 10 }}><Score value={rv.overall} /></div>
      <p style={{ marginTop: 14, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{rv.body || '(서술 없음, 별점만 등록)'}</p>
      <ReplyBox reviewId={rv.id} initialReply={rv.reply} canWrite={canReply && !rv.reply} />
      <Engagement
        key={`review-${rv.id}-${rv.my_vote}-${rv.is_scrapped}`}
        kind="review" targetId={rv.id}
        initialUp={rv.up} initialDown={rv.down} initialMyVote={rv.my_vote} initialCommentCount={rv.comment_count}
        initialScrapped={rv.is_scrapped}
      />
      <Link href={`/takedown/review/${rv.id}?station=${encodeURIComponent(rv.station_name)}`} className="sub" style={{ display: 'inline-block', marginTop: 8 }}>
        이 게시물 삭제·정정 요청
      </Link>
    </>
  );
}
