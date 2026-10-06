import { NOINDEX } from '@/lib/seo';

// /admin 하위 전체(로그인 페이지 포함)는 robots.txt disallow와는 별개로 noindex 메타도
// 명시한다 — robots.txt는 "정상적인 크롤러에 대한 요청"일 뿐이라 실제 색인 방지에는
// <meta robots> 쪽이 더 확실하다.
export const metadata = { title: { default: '운영 콘솔', template: '%s | 폴리스맵 운영 콘솔' }, robots: NOINDEX };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
