import type { NextConfig } from 'next';

// 기본 보안 헤더. CSP는 Pretendard CDN·Next 자체 인라인 스크립트 등 허용 목록을 꼼꼼히
// 따져야 해서(잘못 걸면 폰트·하이드레이션이 깨짐) 여기엔 아직 넣지 않았다 — 배포 전 따로 점검.
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // 한 번 HTTPS 로 접속한 브라우저는 1년간 http 로 내려가지 않게 한다. 하위 도메인은 아직
  // 모두 HTTPS 인지 확인되지 않아 includeSubDomains 는 넣지 않았다.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];

const nextConfig: NextConfig = {
  poweredByHeader: false, // X-Powered-By: Next.js 로 프레임워크를 알리지 않는다.
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }];
  },
  async redirects() {
    return [
      // "권리구제 안내"(백과사전)와 "민원 연계"(마법사)가 이름만 봐서 구분이 안 된다는
      // 피드백으로 /remedy 안의 탭 두 개로 합쳤다(components/RemedyNavigator.tsx 참고).
      { source: '/guide', destination: '/remedy?tab=all', permanent: true },
    ];
  },
};

export default nextConfig;
