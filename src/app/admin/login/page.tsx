'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogIn, MapPinned } from 'lucide-react';
import { Card } from '@/components/ui';
import { ApiError, login } from '@/lib/api';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const user = await login(email.trim(), password);
      if (user.role !== 'admin') {
        setError('관리자 계정이 아닙니다.');
        return;
      }
      router.replace(params.get('next') || '/admin');
    } catch (e) {
      if (e instanceof ApiError && e.status === 429) setError('로그인 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
      else setError('이메일 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card style={{ maxWidth: 400, width: '100%' }}>
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
      </form>
    </Card>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="admin-login">
      <div className="admin-login-brand">
        <span className="mark"><MapPinned size={18} /></span>
        <b>폴리스맵 운영 콘솔</b>
        <p className="sub">평가 검수·삭제요청 처리 권한이 있는 관리자 계정으로 로그인하세요.</p>
      </div>
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
