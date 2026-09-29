'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RefreshCcw, ServerCrash } from 'lucide-react';
import { Card } from '@/components/ui';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Card>
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div className="policy-ico" style={{ margin: '0 auto 18px' }}><ServerCrash size={20} /></div>
        <h1 style={{ fontSize: 26 }}>일시적으로 정보를 불러올 수 없습니다</h1>
        <p className="sub" style={{ margin: '10px 0 22px' }}>
          서버 연결에 문제가 있는 것 같습니다. 잠시 후 다시 시도해 주세요.
        </p>
        <div className="btn-row" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => reset()}><RefreshCcw size={16} />다시 시도</button>
          <Link href="/" className="btn line">홈으로</Link>
        </div>
      </div>
    </Card>
  );
}
