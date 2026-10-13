import type { Metadata } from 'next';
import { CaseDetailView } from '@/components/CaseDetailView';
import { Crumb } from '@/components/ui';
import { getCase, type CaseDetail } from '@/lib/api';
import { NOINDEX } from '@/lib/seo';

type Props = { params: Promise<{ id: string }> };

// 링크 공유용 제목·요약은 보여주되, 검색엔진 색인은 막는다 — 일방 주장이 이름 검색 결과에
// 오래 남는 것을 막기 위해서(공유로 퍼지는 것과 검색으로 박제되는 것은 다르다).
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  try {
    const c = await getCase(Number((await params).id));
    return { title: c.title, description: c.excerpt, robots: NOINDEX, openGraph: { title: c.title, description: c.excerpt } };
  } catch {
    return { title: '사건 공론화', robots: NOINDEX };
  }
}

export default async function CasePage({ params }: Props) {
  const id = Number((await params).id);
  // 서버 렌더는 비로그인 기준이라 공개된 사건만 받아온다. 보류·블라인드된 본인 글은
  // 클라이언트에서 쿠키를 실어 다시 불러와 보여준다(CaseDetailView).
  const initial: CaseDetail | null = await getCase(id).catch(() => null);

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: '사건 공론화', to: '/cases' }, { label: initial?.title ?? '사건' }]} />
      <CaseDetailView id={id} initial={initial} />
    </>
  );
}
