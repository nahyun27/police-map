import Link from 'next/link';

export default function Footer() {
  return (
    <footer className="site">
      <div className="fwrap">
        <div className="flogo">폴리스맵</div>
        <div className="flinks">
          <Link href="/policy">이용약관</Link>
          <Link href="/policy">커뮤니티 가이드라인</Link>
          <Link href="/policy">개인정보처리방침</Link>
          <Link href="/policy">삭제·정정 요청</Link>
        </div>
        <p>
          폴리스맵(가칭) 프로토타입 · 국민 참여형 수사기관 평가 플랫폼<br />
          본 사이트는 공무집행의 투명성 제고라는 공익 목적으로 직무수행 관련 정보만을 다루며, 사생활 정보는 게재하지 않습니다.
        </p>
      </div>
    </footer>
  );
}
