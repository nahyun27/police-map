import { Fragment, type CSSProperties, type ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight, Star } from 'lucide-react';

/** 평가가 아직 없으면 value=null — 빈 별로 표시한다. */
export function Stars({ value }: { value: number | null }) {
  if (value === null) return <span className="stars" aria-label="평가 없음">☆☆☆☆☆</span>;
  const f = Math.max(0, Math.min(5, Math.round(value)));
  return <span className="stars" aria-label={`5점 만점에 ${value.toFixed(1)}점`}>{'★'.repeat(f) + '☆'.repeat(5 - f)}</span>;
}

/** 평점(별 5개 채우기 + 숫자). 3.8 이상 good, 3.2 이상 mid, 그 미만 low. value=null 이면 "평가 없음". */
export function Score({ value }: { value: number | null }) {
  if (value === null) {
    // 목록에서 수십 번 반복되므로 굵은 점수보다 한 단계 흐리고 가볍게 보이게 한다.
    return <span className="score score-empty">평가 없음</span>;
  }
  const tone = value >= 3.8 ? 'good' : value >= 3.2 ? 'mid' : 'low';
  const filled = Math.max(0, Math.min(5, Math.round(value)));
  return (
    <span className={`score ${tone}`} aria-label={`5점 만점에 ${value.toFixed(1)}점`}>
      <span className="score-stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} size={13} fill={i <= filled ? 'currentColor' : 'none'} strokeWidth={i <= filled ? 0 : 1.6} />
        ))}
      </span>
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

export function Card({ children, className = '', style, id }: { children: ReactNode; className?: string; style?: CSSProperties; id?: string }) {
  return <div id={id} className={`card ${className}`.trim()} style={style}>{children}</div>;
}

export function PageHead({
  title, sub, actions, children, center,
}: { eyebrow?: string; title: string; sub?: string; actions?: ReactNode; children?: ReactNode; center?: boolean }) {
  return (
    <header className={`pagehead${center ? ' center' : ''}`}>
      <div className="pagehead-title-row">
        <h1>{title}</h1>
        {actions}
      </div>
      {sub && <p className="lead">{sub}</p>}
      {children}
    </header>
  );
}

export function TableWrap({ children }: { children: ReactNode }) {
  return <div className="table-wrap">{children}</div>;
}

/** 통계·목록 등에서 데이터가 아직 없을 때 쓰는 공통 빈 상태. 밋밋한 회색 문장 한 줄 대신
 * 아이콘을 곁들여서 "아직 비어 있을 뿐 고장난 게 아니다"라는 느낌을 준다. */
export function EmptyState({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="empty-state">
      <div className="empty-ico">{icon}</div>
      <p className="sub">{children}</p>
    </div>
  );
}
