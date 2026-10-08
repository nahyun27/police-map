import type { ReactNode } from 'react';

// 커뮤니티(게시판) 영역만 먼저 토스 스타일로 다듬어 달라는 요청(2026-10)에 맞춰, 이 레이아웃
// 아래 페이지(/board, /board/[id], /board/write)에만 .board-ui 스코프를 씌운다. 사이트 다른
// 영역의 공용 카드·버튼 스타일은 그대로 둔 채, globals.css 의 .board-ui 전용 규칙만으로
// 카드·버튼·탭·댓글 모양을 바꾼다.
export default function BoardLayout({ children }: { children: ReactNode }) {
  return <div className="board-ui">{children}</div>;
}
