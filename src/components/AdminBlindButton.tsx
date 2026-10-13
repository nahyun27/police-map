'use client';

import { useEffect, useState } from 'react';
import { EyeOff } from 'lucide-react';
import { adminBlind, getMe, type BlindableType } from '@/lib/api';

// 한 페이지에 평가가 여러 개 있어도 /auth/me 는 한 번만 부르도록 모듈 단위로 결과를 공유한다.
let adminCheck: Promise<boolean> | null = null;
function isAdmin(): Promise<boolean> {
  adminCheck ??= getMe().then((me) => me.role === 'admin').catch(() => false);
  return adminCheck;
}

/** 관리자에게만 보이는 "즉시 블라인드" 버튼. 공개 화면에서 심각한 게시물을 발견했을 때
 * 관리자 콘솔로 가지 않고 그 자리에서 바로 비공개 처리하기 위한 것(2026-10 결정). */
export function AdminBlindButton({ targetType, targetId, onDone }: { targetType: BlindableType; targetId: number; onDone?: () => void }) {
  const [show, setShow] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  useEffect(() => { isAdmin().then(setShow); }, []);
  if (!show) return null;
  if (state === 'done') return <span className="sub">블라인드 처리됨</span>;

  const run = async () => {
    const reason = prompt('블라인드 사유(작성자 마이페이지에 표시됩니다). 비우면 기본 문구가 들어갑니다.', '');
    if (reason === null) return;
    setState('busy');
    try {
      await adminBlind(targetType, targetId, reason.trim());
      setState('done');
      onDone?.();
    } catch { setState('error'); }
  };

  return (
    <button type="button" className="btn line sm danger" onClick={run} disabled={state === 'busy'}>
      <EyeOff size={13} />{state === 'error' ? '실패 · 다시 시도' : '관리자: 즉시 블라인드'}
    </button>
  );
}
