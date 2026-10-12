'use client';

import { useEffect, useRef, useState } from 'react';
import { search, type StationItem } from '@/lib/api';

/** 검색창 자동완성. 입력할 때마다 호출하지 않고 220ms 디바운스하고, 느린 응답이 더 최신
 * 요청 결과를 덮어쓰지 않도록 요청 순번(seq)으로 막는다 — 흔한 "늦게 온 이전 글자 결과가
 * 방금 친 글자 결과를 지워버리는" 자동완성 버그를 피하기 위함. */
export function useSearchSuggestions(q: string, enabled: boolean) {
  const [items, setItems] = useState<StationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const term = q.trim();
    if (!enabled || !term) {
      setItems([]);
      setLoading(false);
      return;
    }
    const mySeq = ++seq.current;
    setLoading(true);
    const t = setTimeout(() => {
      search(term)
        .then((r) => { if (seq.current === mySeq) setItems(r.stations.slice(0, 8)); })
        .catch(() => { if (seq.current === mySeq) setItems([]); })
        .finally(() => { if (seq.current === mySeq) setLoading(false); });
    }, 220);
    return () => clearTimeout(t);
  }, [q, enabled]);

  return { items, loading };
}
