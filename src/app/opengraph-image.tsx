import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// 카카오톡·트위터 등에 링크를 공유했을 때 뜨는 미리보기 이미지. next/og(Satori)는 브라우저
// CSS 폰트 로딩이 아니라 폰트 "파일"을 직접 줘야 해서, 사이트에서 쓰는 Pretendard 의 정적
// otf 파일을 CDN에서 받아와 그대로 넘긴다(가변 폰트·woff2는 Satori가 못 읽는다).
// 구글 이미지 검색 등은 이 이미지를 정사각에 가깝게 가운데를 잘라 보여 주므로, 로고와 이름을 가운데에 모은다.
async function loadFont(weight: string) {
  const res = await fetch(`https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-${weight}.otf`);
  return res.arrayBuffer();
}

export default async function OpengraphImage() {
  const [bold, extraBold, medium, mark] = await Promise.all([
    loadFont('Bold'), loadFont('ExtraBold'), loadFont('Medium'),
    readFile(join(process.cwd(), 'public/images/logo-mark.png')),
  ]);
  const markSrc = `data:image/png;base64,${mark.toString('base64')}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: '#fff', position: 'relative', overflow: 'hidden', fontFamily: 'Pretendard',
          background:
            'radial-gradient(900px 480px at 50% -20%, rgba(88,130,255,.55), transparent 62%),' +
            'radial-gradient(700px 420px at 50% 125%, rgba(36,86,245,.40), transparent 60%),' +
            '#0a1b3d',
        }}
      >
        <div
          style={{
            width: 132, height: 132, borderRadius: 36, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 24px 60px rgba(0,0,0,.35)',
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og 안에서는 img 만 쓸 수 있다 */}
          <img src={markSrc} width={92} height={92} alt="" />
        </div>
        <div style={{ display: 'flex', marginTop: 34, fontSize: 92, fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1 }}>
          <span style={{ color: '#fff' }}>폴리스</span>
          <span style={{ color: '#9db8ff' }}>맵</span>
        </div>
        <div style={{ display: 'flex', marginTop: 26, fontSize: 32, fontWeight: 700, color: '#dbe4ff', letterSpacing: '-0.02em' }}>
          수사 절차의 투명성, 국민이 만듭니다
        </div>
        <div style={{ display: 'flex', marginTop: 14, fontSize: 22, fontWeight: 500, color: '#9fb0d8' }}>
          전국 경찰서·수사부서 평가 · 수사 경험 후기 · 권리구제 안내
        </div>
        <div style={{ display: 'flex', position: 'absolute', bottom: 40, fontSize: 20, color: '#7f93c9', fontWeight: 500 }}>
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
