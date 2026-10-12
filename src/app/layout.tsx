import type { Metadata, Viewport } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import MainArea from '@/components/MainArea';
import { ALLOW_INDEXING, NOINDEX, SITE_URL } from '@/lib/seo';
import './globals.css';

const TITLE = '폴리스맵: 국민 참여형 수사기관 평가 플랫폼';
const DESCRIPTION =
  '전국 경찰관서·수사부서의 공개정보와 수사 절차를 직접 경험한 국민의 사실 기반 평가, 그리고 권리구제 절차 안내를 한곳에서.';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s | 폴리스맵' },
  description: DESCRIPTION,
  robots: ALLOW_INDEXING ? { index: true, follow: true } : NOINDEX,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: '폴리스맵',
    url: SITE_URL,
    locale: 'ko_KR',
    type: 'website',
  },
  // 트위터는 twitter:image 가 없으면 og:image(위 openGraph, opengraph-image.tsx 가 자동
  // 생성)로 알아서 대체해서 보여준다 — 카드 종류만 지정하면 이미지는 따로 안 줘도 된다.
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = { themeColor: '#0a1b3d' };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
      </head>
      <body>
        <Header />
        <MainArea>{children}</MainArea>
        <Footer />
      </body>
    </html>
  );
}
