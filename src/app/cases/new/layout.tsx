import { NOINDEX } from '@/lib/seo';

// 클라이언트 페이지라 탭 제목이 사이트 기본값으로만 보이던 문제. 제목을 붙이고 검색 노출은 막는다.
export const metadata = { title: '사건 공론화 글쓰기', robots: NOINDEX };

export default function NewCaseLayout({ children }: { children: React.ReactNode }) {
  return children;
}
