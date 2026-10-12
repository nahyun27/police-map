'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { useSearchSuggestions } from '@/lib/useSearchSuggestions';

export default function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { items, loading } = useSearchSuggestions(q, open);
  const wrapRef = useRef<HTMLDivElement>(null);
  // 히어로 섹션(.hero)이 둥근 모서리 배경을 잘라내려고 overflow:hidden 을 쓰고 있어서,
  // 드롭다운을 그 안에 그대로 두면 섹션 아래로 넘치는 부분이 잘린다. document.body 에
  // 포털로 그려서 잘림을 피하고, 입력창 위치를 재서 CSS로 좌표만 맞춰 준다.
  const [rect, setRect] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = wrapRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setRect({ top: r.bottom + window.scrollY + 6, left: r.left + window.scrollX, width: r.width });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  const goStation = (id: number) => {
    setOpen(false);
    router.push(`/station/${id}`);
  };

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term) { setOpen(false); router.push(`/search?q=${encodeURIComponent(term)}`); }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? items.length - 1 : i - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); goStation(items[active].id); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const showSuggest = open && q.trim() && (items.length > 0 || loading) && rect;

  return (
    <div className="bigsearch-wrap" ref={wrapRef}>
      <form className="bigsearch" onSubmit={onSearch} role="search">
        <Search size={20} />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          placeholder="경찰서 또는 수사관 이름을 검색하세요"
          aria-label="검색"
          role="combobox" aria-expanded={open && items.length > 0} aria-autocomplete="list"
          autoComplete="off"
        />
        <button className="btn" type="submit">검색</button>
      </form>
      {showSuggest && typeof document !== 'undefined' && createPortal(
        <ul className="search-suggest search-suggest-portal" style={{ top: rect.top, left: rect.left, width: rect.width }}>
          {items.map((s, i) => (
            <li key={s.id}>
              <button
                type="button" className={i === active ? 'active' : ''}
                onMouseDown={() => goStation(s.id)} onMouseEnter={() => setActive(i)}
              >
                <b>{s.name}</b><span className="sub">{s.address ?? '주소 정보 없음'}</span>
              </button>
            </li>
          ))}
          {loading && !items.length && <li className="search-suggest-empty">검색 중…</li>}
        </ul>,
        document.body,
      )}
    </div>
  );
}
