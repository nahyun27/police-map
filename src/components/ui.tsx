import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight, Star } from 'lucide-react';

/** 평가가 아직 없으면 value=null — 빈 별로 표시한다. */
export function Stars({ value }: { value: number | null }) {
  if (value === null) return <span className="stars" aria-label="평가 없음">☆☆☆☆☆</span>;
  const f = Math.max(0, Math.min(5, Math.round(value)));
  return <span className="stars" aria-label={`5점 만점에 ${value.toFixed(1)}점`}>{'★'.repeat(f) + '☆'.repeat(5 - f)}</span>;
}

/** 평점 알약 — 3.8 이상 good, 3.2 이상 mid, 그 미만 low. value=null 이면 "평가 없음". */
export function Score({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="score" style={{ background: 'var(--line2)', color: 'var(--muted)' }}>평가 없음</span>;
  }
  const tone = value >= 3.8 ? 'good' : value >= 3.2 ? 'mid' : 'low';
  return (
    <span className={`score ${tone}`}>
      <Star size={12} fill="currentColor" strokeWidth={0} />
      {value.toFixed(1)}
    </span>
  );
}

interface RatingDims {
  fair: number | null;
  proc: number | null;
  att: number | null;
  comm: number | null;
  speed: number | null;
}

export function Bars({ rating }: { rating: RatingDims }) {
  const items: [string, number | null][] = [
    ['공정성', rating.fair],
    ['절차 준수', rating.proc],
    ['조사 태도', rating.att],
    ['소통·응대', rating.comm],
    ['신속성', rating.speed],
  ];
  return (
    <>
      {items.map(([label, raw]) => {
        const v = raw === null ? 0 : Math.max(0, Math.min(5, raw));
        return (
          <div className="barrow" key={label}>
            <div className="lb">{label}</div>
            <div className="bar"><i style={{ width: `${(v / 5) * 100}%` }} /></div>
            <div className="vl">{raw === null ? '-' : raw.toFixed(1)}</div>
          </div>
        );
      })}
    </>
  );
}

/** label만 있으면 현재 페이지, to가 있으면 링크 */
export function Crumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <nav className="crumb" aria-label="현재 위치">
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 && <ChevronRight size={14} />}
          {it.to ? <Link href={it.to}>{it.label}</Link> : <span>{it.label}</span>}
        </Fragment>
      ))}
    </nav>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}

export function PageHead({ eyebrow, title, sub, children }: { eyebrow?: string; title: string; sub?: string; children?: ReactNode }) {
  return (
    <header className="pagehead">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      {sub && <p className="lead">{sub}</p>}
      {children}
    </header>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="table-wrap">{children}</div>;
}
