'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';

export default function TakedownStatusLookup() {
  const router = useRouter();
  const [code, setCode] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed) router.push(`/takedown/status/${encodeURIComponent(trimmed)}`);
  };

  return (
    <form onSubmit={submit} className="field" style={{ marginBottom: 0 }}>
      <label>접수 코드</label>
      <div style={{ display: 'flex', gap: 8 }}>
        <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="접수 시 안내받은 코드를 입력하세요" style={{ flex: 1 }} />
        <button className="btn" type="submit"><Search size={16} />조회</button>
      </div>
    </form>
  );
}
