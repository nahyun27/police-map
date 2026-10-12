'use client';

import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
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
      {open && q.trim() && (items.length > 0 || loading) && (
        <ul className="search-suggest">
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
        </ul>
      )}
    </div>
  );
}
