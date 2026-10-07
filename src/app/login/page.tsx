'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { LogIn } from 'lucide-react';
import { Card, PageHead } from '@/components/ui';
import { ApiError, login } from '@/lib/api';

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
      router.replace(params.get('next') || '/mypage');
      router.refresh();
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) setError('로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
      else setError('이메일 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card style={{ maxWidth: 420, margin: '0 auto' }}>
      <form onSubmit={submit}>
        <div className="field">
          <label>이메일</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </div>
        <div className="field">
          <label>비밀번호</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
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
      <PageHead eyebrow="로그인" title="로그인" sub="로그인하지 않아도 평가·제보 작성은 그대로 가능합니다." />
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
