'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { AdminBlindButton } from '@/components/AdminBlindButton';
import { Engagement } from '@/components/Engagement';
import { ReplyBox } from '@/components/ReplyBox';
import { Score } from '@/components/ui';
import { getMe, getMyReviewStates, type ReviewMyState, type ReviewPublic } from '@/lib/api';
import { formatDate } from '@/lib/format';

/** 평가 목록 렌더링 + "이 경찰서 소속으로 인증된 내 계정" 여부를 한 번만 확인해서 각 해명
 * 작성 버튼에 전달한다(리뷰마다 따로 /auth/me 를 부르지 않기 위해 이 레벨에서 한 번만 호출).
 * 목록(items)은 서버에서 쿠키 없이 렌더된 것이라 내 추천·스크랩·내 해명 여부가 늘 비로그인
 * 기준이다. 그래서 마운트 후 /reviews/my-state 로 그 값만 한 번에 받아 덮어쓴다. */
export function ReviewList({ stationId, items }: { stationId: number; items: ReviewPublic[] }) {
  const [canReply, setCanReply] = useState(false);
  const [myStates, setMyStates] = useState<Map<number, ReviewMyState> | null>(null);
  const idsKey = items.map((rv) => rv.id).join(',');

  useEffect(() => {
    let cancelled = false;
    getMe().then((me) => { if (!cancelled) setCanReply(me.officer_station_id === stationId); }).catch(() => {});
    return () => { cancelled = true; };
  }, [stationId]);

  useEffect(() => {
    if (!idsKey) return;
    let cancelled = false;
    // 실패하면(옛 백엔드, 네트워크 오류 등) 서버가 준 기본값을 그대로 둔다. 화면이 깨질 일은 아니라 조용히 넘긴다.
    getMyReviewStates(idsKey.split(',').map(Number))
      .then((r) => { if (!cancelled) setMyStates(new Map(r.items.map((it) => [it.id, it]))); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [idsKey]);

  return (
    <>
      {items.map((base) => {
        const st = myStates?.get(base.id);
        const rv: ReviewPublic = st
          ? {
            ...base, my_vote: st.my_vote, is_scrapped: st.is_scrapped,
            reply: base.reply ? { ...base.reply, is_mine: st.reply_is_mine } : null,
          }
          : base;
        return (
        <div className="review" key={rv.id}>
          <div className="meta">
            <span className="badge brand">{rv.role_label}</span><span className="badge">{rv.case_type_label}</span>{rv.target_label && <span className="badge target">{rv.target_label}</span>}{formatDate(rv.published_at)}
            {rv.evidence_verified && <span className="badge good" title="운영진이 증빙자료 제출 사실을 확인했다는 표시입니다. 서술 내용 전체의 사실 여부를 보증하지는 않습니다."><ShieldCheck size={11} />증빙확인</span>}
          </div>
          <div className="head"><Score value={rv.overall} /></div>
          <p className="review-body">{rv.body || '(서술 없음, 별점만 등록)'}</p>
          {/* Engagement·ReplyBox 는 initial* 값을 첫 렌더에만 상태로 옮겨 담으므로, 내 상태를
              받아 온 뒤 다시 마운트되도록 그 값을 key 에 넣는다(ReviewDetail 과 같은 방식). */}
          <ReplyBox
            key={`reply-${rv.id}-${rv.reply?.id ?? 0}-${rv.reply?.is_mine ? 1 : 0}`}
            reviewId={rv.id} initialReply={rv.reply} canWrite={canReply && !rv.reply}
          />
          <Engagement
            key={`review-${rv.id}-${rv.my_vote}-${rv.is_scrapped}`}
            kind="review" targetId={rv.id}
            initialUp={rv.up} initialDown={rv.down} initialMyVote={rv.my_vote} initialCommentCount={rv.comment_count}
            initialScrapped={rv.is_scrapped}
          />
          <div className="btn-row" style={{ marginTop: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href={`/takedown/review/${rv.id}`} className="sub">
              이 게시물 삭제·정정 요청
            </Link>
            <AdminBlindButton targetType="review" targetId={rv.id} />
          </div>
        </div>
        );
      })}
    </>
  );
}
