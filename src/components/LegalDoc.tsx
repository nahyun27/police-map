import type { ReactNode } from 'react';
import { Card } from '@/components/ui';

export type LegalSection = { title: string; body: ReactNode };

/** 이용약관·개인정보처리방침 공용 레이아웃. 조항 목록을 위에 두고 각 조항으로 바로 이동할 수 있게 한다
 * (긴 문서를 모바일에서 끝까지 스크롤하지 않아도 되도록). */
export function LegalDoc({ sections, footer }: { sections: LegalSection[]; footer: ReactNode }) {
  return (
    <Card className="legal-doc">
      <nav className="legal-toc" aria-label="목차">
        <ol>
          {sections.map((s, i) => (
            <li key={s.title}><a href={`#s${i + 1}`}>{s.title}</a></li>
          ))}
        </ol>
      </nav>
      {sections.map((s, i) => (
        <section key={s.title} id={`s${i + 1}`}>
          <h2>{s.title}</h2>
          {s.body}
        </section>
      ))}
      <div className="legal-footer">{footer}</div>
    </Card>
  );
}
