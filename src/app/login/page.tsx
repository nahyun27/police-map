'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LogIn, ShieldCheck } from 'lucide-react';
import { Card, PageHead } from '@/components/ui';
import { resetAdminCheck } from '@/components/AdminBlindButton';
import { apiErrorMessage, login } from '@/lib/api';
import { safeNext } from '@/lib/format';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
      resetAdminCheck();
      router.replace(safeNext(params.get('next'), '/mypage'));
      router.refresh();
    } catch (e) {
      // 예전엔 연결 실패·서버 오류까지 전부 "비밀번호가 틀렸다"로 보여서, 맞는 비밀번호를 계속 바꿔
      // 입력하게 만들었다. 백엔드는 자격 증명이 틀리면 401 을 주므로 그 경우에만 이 문구를 쓴다.
      setError(apiErrorMessage(e, {
        byStatus: {
          401: '이메일 또는 비밀번호가 올바르지 않습니다.',
          429: '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.',
        },
      }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card style={{ maxWidth: 420, margin: '0 auto' }}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="li-1">이메일</label>
          <input id="li-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="li-2">비밀번호</label>
          <input id="li-2" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
        </div>
        {error && <div className="warn">{error}</div>}
        <button className="btn lg" type="submit" style={{ width: '100%' }} disabled={submitting}>
          <LogIn size={16} />{submitting ? '로그인 중…' : '로그인'}
        </button>
        <p className="sub" style={{ marginTop: 14, textAlign: 'center' }}>
          계정이 없으신가요? <Link href="/signup">회원가입</Link>
        </p>
      </form>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <>
      <PageHead center eyebrow="로그인" title="로그인" sub="로그인하지 않아도 평가·제보 작성은 그대로 가능합니다." />
      <Suspense>
        <LoginForm />
      </Suspense>
      {/* 가입·로그인 화면 아래 짧은 보안 안내(신뢰감). 자세한 내용은 개인정보처리방침. */}
      <p className="auth-trust">
        <ShieldCheck size={14} />비밀번호는 복원할 수 없게 암호화해 저장하며, 이메일은 회원 관리에만 씁니다.{' '}
        <Link href="/privacy">개인정보처리방침</Link>
      </p>
    </>
  );
}
