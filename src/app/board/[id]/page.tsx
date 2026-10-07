import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PostDetail } from '@/components/PostDetail';
import { Card, Crumb } from '@/components/ui';
import { ApiError, getPost } from '@/lib/api';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const p = await getPost(Number((await params).id));
    return { title: p.title, description: p.body.slice(0, 100) };
  } catch {
    return {};
  }
}

export default async function PostPage({ params }: Props) {
  const id = Number((await params).id);
  let p;
  try {
    p = await getPost(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: '커뮤니티 게시판', to: '/board' }, { label: p.title }]} />
      <Card>
        <PostDetail initial={p} />
      </Card>
    </>
  );
}
