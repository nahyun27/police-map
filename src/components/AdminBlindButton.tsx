'use client';

import { useEffect, useState } from 'react';
import { EyeOff } from 'lucide-react';
import { ApiError, adminBlind, getMe, type BlindableType } from '@/lib/api';

// 한 페이지에 평가가 여러 개 있어도 /auth/me 는 한 번만 부르도록 모듈 단위로 결과를 공유한다.
// 단, 이 값은 클라이언트 내비게이션 동안 계속 살아 있으므로 로그인·로그아웃 때 resetAdminCheck()
// 로 비워야 한다(안 그러면 관리자가 로그아웃해도 버튼이 남고, 로그인해도 안 뜬다).
let adminCheck: Promise<boolean> | null = null;
function isAdmin(): Promise<boolean> {
  adminCheck ??= getMe().then((me) => me.role === 'admin').catch((e) => {
    // 401(비로그인)은 확정된 답이라 캐시해 두지만, 연결 끊김·서버 오류 같은 일시적 실패를 false 로
    // 굳혀 두면 다시 확인할 길이 없어진다. 그럴 땐 캐시를 비워 다음 마운트에서 다시 묻는다.
    if (!(e instanceof ApiError && e.status === 401)) adminCheck = null;
    return false;
  });
  return adminCheck;
}

/** 로그인·로그아웃 직후 호출해 관리자 여부 캐시를 비운다. */
export function resetAdminCheck() {
  adminCheck = null;
}

/** 관리자에게만 보이는 "즉시 블라인드" 버튼. 공개 화면에서 심각한 게시물을 발견했을 때
 * 관리자 콘솔로 가지 않고 그 자리에서 바로 비공개 처리하기 위한 것(2026-10 결정). */
export function AdminBlindButton({ targetType, targetId, onDone }: { targetType: BlindableType; targetId: number; onDone?: () => void }) {
  const [show, setShow] = useState(false);
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>('idle');

  useEffect(() => {
    let cancelled = false;
    isAdmin().then((v) => { if (!cancelled) setShow(v); });
    return () => { cancelled = true; };
  }, []);
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
