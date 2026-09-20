'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export default function HeroSearch() {
  const router = useRouter();
  const [q, setQ] = useState('');

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term) router.push(`/search?q=${encodeURIComponent(term)}`);
  };

  return (
    <form className="bigsearch" onSubmit={onSearch} role="search">
      <Search size={20} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="경찰서 또는 수사관 이름을 검색하세요" aria-label="검색" />
      <button className="btn" type="submit">검색</button>
    </form>
  );
}
