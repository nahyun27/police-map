import type { NextConfig } from 'next';

// 기본 보안 헤더. CSP는 Pretendard CDN·Next 자체 인라인 스크립트 등 허용 목록을 꼼꼼히
// 따져야 해서(잘못 걸면 폰트·하이드레이션이 깨짐) 여기엔 아직 넣지 않았다 — 배포 전 따로 점검.
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
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
