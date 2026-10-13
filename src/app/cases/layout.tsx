import type { ReactNode } from 'react';

// 사건 공론화도 커뮤니티와 같은 카드·탭·버튼 모양(.board-ui 스코프)을 쓴다.
export default function CasesLayout({ children }: { children: ReactNode }) {
  return <div className="board-ui">{children}</div>;
}
