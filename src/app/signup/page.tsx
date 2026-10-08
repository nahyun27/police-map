'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { Card, PageHead } from '@/components/ui';
import { ApiError, register } from '@/lib/api';

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError('비밀번호는 8자 이상이어야 합니다.'); return; }
    if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    setSubmitting(true);
    try {
      await register(email.trim(), password, nickname.trim());
      router.replace(params.get('next') || '/mypage');
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError('이미 가입된 이메일입니다.');
      else if (e instanceof ApiError && e.status === 429) setError('가입 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
      else if (e instanceof ApiError && e.status === 422) setError('입력값을 확인해 주세요(닉네임 2자 이상, 비밀번호 8자 이상).');
      else setError('가입에 실패했습니다. 잠시 후 다시 시도해 주세요.');
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
          <label>닉네임</label>
          <input type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} autoComplete="nickname" minLength={2} maxLength={30} required />
        </div>
        <div className="field">
          <label>비밀번호 <span className="tag">8자 이상</span></label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
        </div>
        <div className="field">
          <label>비밀번호 확인</label>
          <input
            type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
            autoComplete="new-password" minLength={8} required
          />
        </div>
        {error && <div className="warn">{error}</div>}
        <button className="btn lg" type="submit" style={{ width: '100%' }} disabled={submitting}>
          <UserPlus size={16} />{submitting ? '가입 중…' : '회원가입'}
        </button>
        <p className="sub" style={{ marginTop: 14, textAlign: 'center' }}>
          이미 계정이 있으신가요? <Link href="/login">로그인</Link>
        </p>
      </form>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <>
      <PageHead
        eyebrow="회원가입"
        title="폴리스맵 계정 만들기"
        sub="계정 없이도 평가·제보 작성은 그대로 가능합니다. 로그인하면 내가 쓴 글을 모아볼 수 있어요."
      />
      <Suspense>
        <SignupForm />
      </Suspense>
    </>
  );
}
