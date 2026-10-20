import type { Metadata, Viewport } from 'next';
import Footer from '@/components/Footer';
import Header from '@/components/Header';
import MainArea from '@/components/MainArea';
import { ALLOW_INDEXING, NOINDEX, SITE_URL } from '@/lib/seo';
import './globals.css';

// 검색 결과 제목은 앞 30자 안팎만 보이므로 사람들이 실제로 검색하는 말(경찰서 평가·수사 후기)을 앞에 둔다.
const TITLE = '폴리스맵: 경찰서·수사관 평가와 수사 후기';
const DESCRIPTION =
  '전국 경찰서·수사부서에 대한 국민 참여형 평가와 수사 경험 후기를 한곳에서. 고소·고발, 피해자·피의자로 겪은 수사 절차를 ' +
  '공유하고, 기피신청·수사심의·국민신문고 등 권리구제 방법을 안내합니다.';

// 구글 서치 콘솔·네이버 서치어드바이저 소유 확인 코드. 빌드할 때 환경변수로 넣는다(없으면 태그를 안 넣음).
const GOOGLE_VERIFY = process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION;
const NAVER_VERIFY = process.env.NEXT_PUBLIC_NAVER_SITE_VERIFICATION;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s | 폴리스맵' },
  description: DESCRIPTION,
  applicationName: '폴리스맵',
  keywords: [
    '폴리스맵', '경찰서 평가', '경찰서 후기', '수사관 평가', '수사 후기', '고소 후기', '경찰 수사', '경찰 민원',
    '수사 이의신청', '기피신청', '수사심의', '국민신문고', '권리구제', '경찰서 수사과',
  ],
  robots: ALLOW_INDEXING ? { index: true, follow: true } : NOINDEX,
  verification: {
    ...(GOOGLE_VERIFY ? { google: GOOGLE_VERIFY } : {}),
    ...(NAVER_VERIFY ? { other: { 'naver-site-verification': NAVER_VERIFY } } : {}),
  },
  // og:url 은 여기서 정하지 않는다. 정해 두면 각자 설정이 없는 하위 페이지의 공유 주소가 전부 홈으로 나간다.
  // 페이지별 대표 주소·공유 정보는 lib/seo.ts 의 pageMeta() 로 채운다.
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    siteName: '폴리스맵',
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
