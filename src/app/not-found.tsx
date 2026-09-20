import type { Metadata } from 'next';
import Link from 'next/link';
import { Compass } from 'lucide-react';
import { Card } from '@/components/ui';

export const metadata: Metadata = { title: '페이지를 찾을 수 없습니다' };

export default function NotFound() {
  return (
    <Card>
      <div style={{ textAlign: 'center', padding: '48px 0' }}>
        <div className="policy-ico" style={{ margin: '0 auto 18px' }}><Compass size={20} /></div>
        <h1 style={{ fontSize: 26 }}>페이지를 찾을 수 없습니다</h1>
        <p className="sub" style={{ margin: '10px 0 22px' }}>주소가 잘못되었거나 존재하지 않는 항목입니다.</p>
        <Link href="/" className="btn">홈으로</Link>
      </div>
    </Card>
  );
}
