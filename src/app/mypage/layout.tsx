import { NOINDEX } from '@/lib/seo';

// 본인 계정 전용 페이지라 검색 노출 대상이 아니다(robots.txt disallow와 별개로 메타도 명시).
export const metadata = { title: '마이페이지', robots: NOINDEX };

export default function MyPageLayout({ children }: { children: React.ReactNode }) {
  return children;
}
