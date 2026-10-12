import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// 카카오톡·트위터 등에 링크를 공유했을 때 뜨는 미리보기 이미지. next/og(Satori)는 브라우저
// CSS 폰트 로딩이 아니라 폰트 "파일"을 직접 줘야 해서, 사이트에서 쓰는 Pretendard 의 정적
// otf 파일을 CDN에서 받아와 그대로 넘긴다(가변 폰트·woff2는 Satori가 못 읽는다).
async function loadFont(weight: string) {
  const res = await fetch(`https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-${weight}.otf`);
  return res.arrayBuffer();
}

export default async function OpengraphImage() {
  const [bold, extraBold, medium] = await Promise.all([
    loadFont('Bold'), loadFont('ExtraBold'), loadFont('Medium'),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
          padding: '72px 80px', color: '#fff', position: 'relative', overflow: 'hidden',
          fontFamily: 'Pretendard',
          background:
            'radial-gradient(1000px 500px at 90% -10%, rgba(88,130,255,.55), transparent 60%),' +
            'radial-gradient(700px 420px at -10% 110%, rgba(36,86,245,.45), transparent 60%),' +
            '#0a1b3d',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 16, background: 'rgba(255,255,255,.12)',
              border: '1px solid rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <svg width="30" height="30" viewBox="0 0 32 32" fill="none">
              <path
                d="M16 7c-3.31 0-6 2.63-6 5.88 0 4.41 6 11.12 6 11.12s6-6.71 6-11.12C22 9.63 19.31 7 16 7Zm0 8a2.5 2.5 0 1 1 0-5 2.5 2.5 0 0 1 0 5Z"
                fill="#fff"
              />
            </svg>
          </div>
          <div style={{ display: 'flex', fontSize: 30, fontWeight: 800, letterSpacing: '-0.03em' }}>
            <span style={{ color: '#fff' }}>폴리스</span>
            <span style={{ color: '#9db8ff' }}>맵</span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', marginTop: 70, maxWidth: 920 }}>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, lineHeight: 1.22, letterSpacing: '-0.03em' }}>
            수사 절차의 투명성,
          </div>
          <div style={{ display: 'flex', fontSize: 64, fontWeight: 800, lineHeight: 1.22, letterSpacing: '-0.03em', color: '#9db8ff' }}>
            국민이 만듭니다
          </div>
          <div style={{ display: 'flex', marginTop: 28, fontSize: 25, lineHeight: 1.55, color: '#c7d3f5', fontWeight: 500, maxWidth: 820 }}>
            전국 경찰관서·수사부서의 공개정보와 수사 절차를 직접 경험한 국민의 사실 기반 평가,
            그리고 권리구제 절차 안내를 한곳에서.
          </div>
        </div>

        <div style={{ display: 'flex', position: 'absolute', bottom: 56, left: 80, fontSize: 20, color: '#8ea2d9', fontWeight: 500 }}>
          policemap.co.kr
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Pretendard', data: medium, weight: 500, style: 'normal' },
        { name: 'Pretendard', data: bold, weight: 700, style: 'normal' },
        { name: 'Pretendard', data: extraBold, weight: 800, style: 'normal' },
      ],
    },
  );
}
