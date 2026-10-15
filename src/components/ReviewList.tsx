'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import { AdminBlindButton } from '@/components/AdminBlindButton';
import { Engagement } from '@/components/Engagement';
import { ReplyBox } from '@/components/ReplyBox';
import { Score } from '@/components/ui';
import { getMe, type ReviewPublic } from '@/lib/api';
import { formatDate } from '@/lib/format';

/** 평가 목록 렌더링 + "이 경찰서 소속으로 인증된 내 계정" 여부를 한 번만 확인해서 각 해명
 * 작성 버튼에 전달한다(리뷰마다 따로 /auth/me 를 부르지 않기 위해 이 레벨에서 한 번만 호출). */
export function ReviewList({ stationId, stationName, items }: { stationId: number; stationName: string; items: ReviewPublic[] }) {
  const [canReply, setCanReply] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMe().then((me) => { if (!cancelled) setCanReply(me.officer_station_id === stationId); }).catch(() => {});
    return () => { cancelled = true; };
  }, [stationId]);

  return (
    <>
      {items.map((rv) => (
        <div className="review" key={rv.id}>
          <div className="meta">
            <span className="badge brand">{rv.role_label}</span><span className="badge">{rv.case_type_label}</span>{rv.target_label && <span className="badge target">{rv.target_label}</span>}{formatDate(rv.published_at)}
            {rv.evidence_verified && <span className="badge good" title="운영진이 증빙자료 제출 사실을 확인했다는 표시입니다. 서술 내용 전체의 사실 여부를 보증하지는 않습니다."><ShieldCheck size={11} />증빙확인</span>}
          </div>
          <div className="head"><Score value={rv.overall} /></div>
          <p>{rv.body || '(서술 없음, 별점만 등록)'}</p>
          <ReplyBox reviewId={rv.id} initialReply={rv.reply} canWrite={canReply && !rv.reply} />
          <Engagement
            kind="review" targetId={rv.id}
            initialUp={rv.up} initialDown={rv.down} initialMyVote={rv.my_vote} initialCommentCount={rv.comment_count}
            initialScrapped={rv.is_scrapped}
          />
          <div className="btn-row" style={{ marginTop: 8, alignItems: 'center', justifyContent: 'space-between' }}>
            <Link href={`/takedown/review/${rv.id}?station=${encodeURIComponent(stationName)}`} className="sub">
              이 게시물 삭제·정정 요청
            </Link>
            <AdminBlindButton targetType="review" targetId={rv.id} />
          </div>
        </div>
      ))}
    </>
  );
}
