import { Fragment, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Rating } from '../data/types';

export function Stars({ value }: { value: number }) {
  const f = Math.max(0, Math.min(5, Math.round(value)));
  return <span className="stars">{'★'.repeat(f) + '☆'.repeat(5 - f)}</span>;
}

export function Bars({ rating }: { rating: Rating }) {
  const items: [string, number][] = [
    ['공정성', rating.fair],
    ['절차 준수', rating.proc],
    ['조사 태도', rating.att],
    ['소통·응대', rating.comm],
    ['신속성', rating.speed],
  ];
  return (
    <>
      {items.map(([label, raw]) => {
        const v = Math.max(0, Math.min(5, raw));
        return (
          <div className="barrow" key={label}>
            <div className="lb">{label}</div>
            <div className="bar"><i style={{ width: `${(v / 5) * 100}%` }} /></div>
            <div className="vl">{v.toFixed(1)}</div>
          </div>
        );
      })}
    </>
  );
}

/** label만 있으면 현재 페이지, to가 있으면 링크 */
export function Crumb({ items }: { items: { label: string; to?: string }[] }) {
  return (
    <div className="crumb">
      {items.map((it, i) => (
        <Fragment key={i}>
          {i > 0 && ' › '}
          {it.to ? <Link to={it.to}>{it.label}</Link> : it.label}
        </Fragment>
      ))}
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`card ${className}`.trim()}>{children}</div>;
}
