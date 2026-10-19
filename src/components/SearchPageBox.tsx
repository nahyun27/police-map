'use client';

import { useState, type KeyboardEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import { MAX_SEARCH_LEN } from '@/lib/api';
import { useSearchSuggestions } from '@/lib/useSearchSuggestions';

/** /search 페이지 본문의 검색창. 헤더·홈 검색과 같은 자동완성을 붙였고, "평가 바로 작성하기"
 * (intent=write)로 들어온 경우엔 추천 항목을 고르면 상세 대신 평가 작성 화면으로 바로 보낸다.
 * 엔터로 제출하면 기존처럼 GET 폼으로 /search?q= 결과 목록을 보여준다. */
export function SearchPageBox({ initialQ, forWrite }: { initialQ: string; forWrite: boolean }) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const { items, loading } = useSearchSuggestions(q, open);

  const go = (id: number) => {
    setOpen(false);
    router.push(forWrite ? `/station/${id}/write` : `/station/${id}`);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !items.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => (i + 1) % items.length); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => (i <= 0 ? items.length - 1 : i - 1)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); go(items[active].id); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <form action="/search" style={{ display: 'flex', gap: 10 }}>
      {forWrite && <input type="hidden" name="intent" value="write" />}
      <div style={{ position: 'relative', flex: 1 }}>
        <Search size={16} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)' }} />
        <input
          type="text" name="q" value={q} placeholder="경찰서 이름으로 검색" autoComplete="off" maxLength={MAX_SEARCH_LEN}
          role="combobox" aria-expanded={open && items.length > 0} aria-autocomplete="list"
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(-1); }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={onKeyDown}
          style={{ width: '100%', border: '1px solid var(--line)', background: '#fff', borderRadius: 12, padding: '12px 14px 12px 40px', fontSize: 15, color: 'var(--ink)' }}
        />
        {open && q.trim() && (items.length > 0 || loading) && (
          <ul className="search-suggest">
            {items.map((s, i) => (
              <li key={s.id}>
                <button type="button" className={i === active ? 'active' : ''} onMouseDown={() => go(s.id)} onMouseEnter={() => setActive(i)}>
                  <b>{s.name}</b>
                  <span className="sub">{forWrite ? '이 경찰서 평가 작성하기 →' : (s.address ?? '주소 정보 없음')}</span>
                </button>
              </li>
            ))}
            {loading && !items.length && <li className="search-suggest-empty">검색 중…</li>}
          </ul>
        )}
      </div>
      <button type="submit" className="btn">검색</button>
    </form>
  );
}
