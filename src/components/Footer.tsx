'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LEGAL } from '@/lib/legal';

export default function Footer() {
  const pathname = usePathname();
  // Header 와 동일한 이유로 관리자 콘솔에서는 공개 사이트 푸터를 숨긴다.
  if (pathname.startsWith('/admin')) return null;

  return (
    <footer className="site">
      {/* 기존 링크·문구는 그대로 두고 칸으로 나눴다. 문의 메일과 데이터 출처를 더해 운영 주체를 분명히 한다. */}
      <div className="fwrap">
        <div className="fgrid">
          <div className="fcol fbrand">
            <div className="flogo">폴리스맵</div>
            <p>
              폴리스맵 · 국민 참여형 수사기관 평가 플랫폼<br />
              본 사이트는 공무집행의 투명성 제고라는 공익 목적으로 직무수행 관련 정보만을 다루며, 사생활 정보는 게재하지 않습니다.
            </p>
          </div>
          <div className="fcol">
            <h4>서비스</h4>
            <ul>
              <li><Link href="/board">커뮤니티</Link></li>
              <li><Link href="/cases">사건 공론화</Link></li>
              <li><Link href="/remedy">권리구제</Link></li>
              <li><Link href="/stats">통계</Link></li>
            </ul>
          </div>
          <div className="fcol">
            <h4>정책</h4>
            <ul>
              <li><Link href="/terms">이용약관</Link></li>
              <li><Link href="/policy">운영원칙</Link></li>
              <li><Link href="/privacy"><b>개인정보처리방침</b></Link></li>
              <li><Link href="/takedown/status">삭제·정정 요청</Link></li>
            </ul>
          </div>
          <div className="fcol">
            <h4>문의</h4>
            <ul>
              <li><Link href="/board?category=suggestion">건의하기</Link></li>
              <li><Link href="/advertise">광고·제휴 문의</Link></li>
              <li><a href={`mailto:${LEGAL.contactEmail}`}>{LEGAL.contactEmail}</a></li>
            </ul>
          </div>
        </div>
        <div className="fbottom">
          <span>© 2026 폴리스맵</span>
          <span>관서 정보 출처: 경찰청 전국경찰관서안내 및 각 관서 홈페이지 공개자료</span>
        </div>
      </div>
    </footer>
  );
}
