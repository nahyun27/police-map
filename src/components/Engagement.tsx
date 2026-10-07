'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Bookmark, MessageSquare, ThumbsDown, ThumbsUp, Trash2 } from 'lucide-react';
import {
  ApiError, type CommentOut, type ReportTargetType,
  createPostComment, createReviewComment, deletePostComment, deleteReviewComment,
  getPostComments, getReviewComments, scrapPost, scrapReview, unscrapPost, unscrapReview,
  votePost, votePostComment, voteReview, voteReviewComment,
} from '@/lib/api';
import { formatDate } from '@/lib/format';
import { ReportButton } from '@/components/ReportButton';

type Kind = 'review' | 'post';
type CommentSort = 'new' | 'top';

const COMMENT_REPORT_TYPE: Record<Kind, ReportTargetType> = { review: 'review_comment', post: 'post_comment' };

const ACTIONS: Record<Kind, {
  vote: (id: number, value: 1 | -1 | 0) => Promise<{ score: number; my_vote: number }>;
  list: (id: number, sort?: CommentSort) => Promise<CommentOut[]>;
  create: (id: number, body: string, parentId?: number) => Promise<CommentOut>;
  remove: (commentId: number) => Promise<void>;
  commentVote: (commentId: number, value: 1 | -1 | 0) => Promise<{ score: number; my_vote: number }>;
  scrap: (id: number) => Promise<{ scrapped: boolean }>;
  unscrap: (id: number) => Promise<{ scrapped: boolean }>;
}> = {
  review: {
    vote: voteReview, list: getReviewComments, create: createReviewComment, remove: deleteReviewComment,
    commentVote: voteReviewComment, scrap: scrapReview, unscrap: unscrapReview,
  },
  post: {
    vote: votePost, list: getPostComments, create: createPostComment, remove: deletePostComment,
    commentVote: votePostComment, scrap: scrapPost, unscrap: unscrapPost,
  },
};

/** 댓글 트리에서 id 가 일치하는 노드 하나만 새 값으로 바꾼 사본을 돌려준다(불변 업데이트). */
function updateCommentNode(nodes: CommentOut[], id: number, patch: Partial<CommentOut>): CommentOut[] {
  return nodes.map((n) => (
    n.id === id ? { ...n, ...patch } : { ...n, replies: updateCommentNode(n.replies, id, patch) }
  ));
}

function findComment(nodes: CommentOut[], id: number): CommentOut | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findComment(n.replies, id);
    if (hit) return hit;
  }
  return undefined;
}

/** 평가(리뷰)·게시판 글에 공통으로 붙는 추천/비추천 + 댓글(1단계 대댓글) UI.
 * 로그인 여부를 미리 조회하지 않고, 실제 조치 시 401 을 받으면 그때 로그인 안내를 띄운다
 * (목록에 여러 개가 함께 뜨는 화면에서 카드마다 /auth/me 를 따로 호출하지 않기 위함). */
export function Engagement({
  kind, targetId, initialScore, initialMyVote, initialCommentCount, initialScrapped = false,
}: {
  kind: Kind; targetId: number; initialScore: number; initialMyVote: number; initialCommentCount: number;
  initialScrapped?: boolean;
}) {
  const pathname = usePathname();
  const api = ACTIONS[kind];
  const [score, setScore] = useState(initialScore);
  const [myVote, setMyVote] = useState(initialMyVote);
  const [commentCount, setCommentCount] = useState(initialCommentCount);
  const [scrapped, setScrapped] = useState(initialScrapped);
  const [scrapBusy, setScrapBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<CommentOut[] | null>(null);
  const [commentSort, setCommentSort] = useState<CommentSort>('new');
  const [loading, setLoading] = useState(false);
  const [authNeeded, setAuthNeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState('');

  const loginLink = `/login?next=${encodeURIComponent(pathname)}`;

  const doVote = async (value: 1 | -1) => {
    setAuthNeeded(false); setError(null);
    const next = myVote === value ? 0 : value;
    try {
      const sum = await api.vote(targetId, next);
      setScore(sum.score); setMyVote(sum.my_vote);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAuthNeeded(true);
      else setError('처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const toggleScrap = async () => {
    setAuthNeeded(false); setError(null); setScrapBusy(true);
    try {
      const r = scrapped ? await api.unscrap(targetId) : await api.scrap(targetId);
      setScrapped(r.scrapped);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAuthNeeded(true);
      else setError('처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
    setScrapBusy(false);
  };

  const loadComments = async (sort: CommentSort = commentSort) => {
    setLoading(true);
    try { setComments(await api.list(targetId, sort)); } catch { setError('댓글을 불러오지 못했습니다.'); }
    setLoading(false);
  };

  const toggleOpen = () => {
    const next = !open;
    setOpen(next);
    if (next && comments === null) loadComments();
  };

  const changeSort = (sort: CommentSort) => {
    setCommentSort(sort);
    loadComments(sort);
  };

  const voteComment = async (commentId: number, value: 1 | -1) => {
    const current = comments ? findComment(comments, commentId) : undefined;
    const next = current?.my_vote === value ? 0 : value;
    try {
      const sum = await api.commentVote(commentId, next);
      setComments((cs) => (cs ? updateCommentNode(cs, commentId, { score: sum.score, my_vote: sum.my_vote }) : cs));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAuthNeeded(true);
      else setError('처리하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const submit = async (body: string, parentId?: number) => {
    const text = body.trim();
    if (!text) return;
    setAuthNeeded(false); setError(null);
    try {
      await api.create(targetId, text, parentId);
      await loadComments();
      setCommentCount((c) => c + 1);
      setDraft(''); setReplyDraft(''); setReplyTo(null);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) setAuthNeeded(true);
      else if (e instanceof ApiError && e.status === 422) setError('게시할 수 없는 표현이 포함되어 있는지 확인해 주세요.');
      else setError('등록하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  const remove = async (commentId: number) => {
    try {
      await api.remove(commentId);
      await loadComments();
    } catch {
      setError('삭제하지 못했습니다.');
    }
  };

  const renderComment = (c: CommentOut, depth = 0): ReactNode => (
    <div className="cmt" key={c.id} style={depth ? { marginLeft: 24 } : undefined}>
      <div className="cmt-meta">
        {!c.is_removed && <b>{c.author_nickname}</b>}
        {c.created_at && <span className="sub">{formatDate(c.created_at)}</span>}
      </div>
      <p className={c.is_removed ? 'sub' : undefined}>
        {c.body}{c.is_removed && c.removed_at && <span className="sub"> ({formatDate(c.removed_at)} 삭제)</span>}
      </p>
      {!c.is_removed && (
        <div className="cmt-actions">
          <button type="button" className={`link-btn ${c.my_vote === 1 ? 'on' : ''}`} onClick={() => voteComment(c.id, 1)} aria-label="추천">
            <ThumbsUp size={11} />{c.score}
          </button>
          <button type="button" className={`link-btn ${c.my_vote === -1 ? 'on' : ''}`} onClick={() => voteComment(c.id, -1)} aria-label="비추천">
            <ThumbsDown size={11} />
          </button>
          {depth === 0 && (
            <button type="button" className="link-btn" onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}>답글</button>
          )}
          {c.is_mine ? (
            <button type="button" className="link-btn" onClick={() => remove(c.id)}><Trash2 size={12} />삭제</button>
          ) : (
            <ReportButton targetType={COMMENT_REPORT_TYPE[kind]} targetId={c.id} />
          )}
        </div>
      )}
      {replyTo === c.id && (
        <div className="cmt-form">
          <input value={replyDraft} onChange={(e) => setReplyDraft(e.target.value)} placeholder="답글을 입력하세요" maxLength={1000} />
          <button type="button" className="btn sm" onClick={() => submit(replyDraft, c.id)} disabled={!replyDraft.trim()}>등록</button>
        </div>
      )}
      {c.replies.map((r) => renderComment(r, depth + 1))}
    </div>
  );

  return (
    <div className="engage">
      <div className="engage-bar">
        <button type="button" className={`vote-btn ${myVote === 1 ? 'active up' : ''}`} onClick={() => doVote(1)} aria-label="추천">
          <ThumbsUp size={14} />
        </button>
        <b className={score > 0 ? 'up' : score < 0 ? 'down' : 'sub'}>{score}</b>
        <button type="button" className={`vote-btn ${myVote === -1 ? 'active down' : ''}`} onClick={() => doVote(-1)} aria-label="비추천">
          <ThumbsDown size={14} />
        </button>
        <button type="button" className="link-btn" onClick={toggleOpen}><MessageSquare size={14} />댓글 {commentCount}</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          <ReportButton targetType={kind} targetId={targetId} />
          <button
            type="button" className={`vote-btn scrap-btn ${scrapped ? 'active scrap' : ''}`} onClick={toggleScrap}
            disabled={scrapBusy} aria-label={scrapped ? '스크랩 해제' : '스크랩'}
          >
            <Bookmark size={14} fill={scrapped ? 'currentColor' : 'none'} />
          </button>
        </div>
      </div>
      {authNeeded && <p className="warn">로그인 후 이용할 수 있습니다. <Link href={loginLink}>로그인</Link></p>}
      {error && <p className="warn">{error}</p>}
      {open && (
        <div className="cmt-list">
          {comments && comments.length > 1 && (
            <div className="btn-row" style={{ marginBottom: 8 }}>
              <button type="button" className={`link-btn ${commentSort === 'new' ? 'on' : ''}`} onClick={() => changeSort('new')}>최신순</button>
              <button type="button" className={`link-btn ${commentSort === 'top' ? 'on' : ''}`} onClick={() => changeSort('top')}>추천순</button>
            </div>
          )}
          {loading && <p className="sub">불러오는 중…</p>}
          {comments && comments.length === 0 && <p className="sub">첫 댓글을 남겨 보세요.</p>}
          {comments?.map((c) => renderComment(c))}
          <div className="cmt-form">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="댓글을 입력하세요" maxLength={1000} />
            <button type="button" className="btn sm" onClick={() => submit(draft)} disabled={!draft.trim()}>등록</button>
          </div>
        </div>
      )}
    </div>
  );
}
