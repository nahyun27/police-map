'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, Trash2 } from 'lucide-react';
import { Engagement } from '@/components/Engagement';
import { deletePost, getPost, incrementPostView, type PostOut } from '@/lib/api';
import { formatDate } from '@/lib/format';

/** 서버 컴포넌트가 비로그인 기준으로 먼저 그린 글(제목·본문은 로그인 여부와 무관해 그대로 써도 됨)을
 * 받아, 로그인 상태에서만 달라지는 is_mine·my_vote 만 클라이언트에서 한 번 다시 조회해 보정한다
 * (추천 총점·댓글 수는 조회자와 무관한 값이라 서버 렌더 값이 이미 정확함). 조회수 증가도 여기서
 * 딱 한 번만 호출한다 — GET /posts/{id} 는 메타데이터 생성·서버 렌더·이 보정까지 여러 번
 * 불려서 조회수를 직접 못 올린다(백엔드 쪽 별도 엔드포인트 주석 참고). */
export function PostDetail({ initial }: { initial: PostOut }) {
  const router = useRouter();
  const [post, setPost] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPost(initial.id).then(setPost).catch(() => {});
    incrementPostView(initial.id).catch(() => {});
  }, [initial.id]);

  const remove = async () => {
    if (!confirm('이 글을 삭제할까요? 되돌릴 수 없습니다.')) return;
    setBusy(true);
    try {
      await deletePost(post.id);
      router.replace('/board');
    } catch {
      setError('삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.');
      setBusy(false);
    }
  };

  return (
    <>
      <div className="eyebrow">{post.region_name ?? '전체'}{post.station_name ? ` · ${post.station_name}` : ''}</div>
      <span className={`badge cat-${post.category}`}>{post.category_label}</span>
      <h1>{post.title}</h1>
      <p className="sub" style={{ marginTop: 6 }}>
        {post.author_nickname} · {formatDate(post.created_at)} · <Eye size={12} style={{ verticalAlign: -1 }} /> {post.view_count}
      </p>
      <p style={{ marginTop: 20, whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>{post.body}</p>
      {post.is_mine && (
        <button type="button" className="btn line sm" onClick={remove} disabled={busy} style={{ marginTop: 14 }}>
          <Trash2 size={14} />이 글 삭제
        </button>
      )}
      {error && <div className="warn">{error}</div>}
      <Engagement
        key={`post-${post.id}-${post.my_vote}-${post.is_scrapped}`}
        kind="post" targetId={post.id}
        initialScore={post.score} initialMyVote={post.my_vote} initialCommentCount={post.comment_count}
        initialScrapped={post.is_scrapped}
      />
    </>
  );
}
