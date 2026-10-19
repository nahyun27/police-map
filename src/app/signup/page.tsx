'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { UserPlus } from 'lucide-react';
import { Card, PageHead } from '@/components/ui';
import { ApiError, apiErrorMessage, register } from '@/lib/api';
import { safeNext } from '@/lib/format';
import { TERMS_VERSION } from '@/lib/legal';

function SignupForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [ageOver14, setAgeOver14] = useState(false);
  const allAgreed = agreeTerms && agreePrivacy && ageOver14;
  const setAll = (v: boolean) => { setAgreeTerms(v); setAgreePrivacy(v); setAgeOver14(v); };
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError('비밀번호는 8자 이상이어야 합니다.'); return; }
    if (password !== passwordConfirm) { setError('비밀번호가 일치하지 않습니다.'); return; }
    if (!allAgreed) { setError('필수 항목에 모두 동의해 주세요.'); return; }
    setSubmitting(true);
    try {
      await register(email.trim(), password, nickname.trim(), {
        agree_terms: agreeTerms, agree_privacy: agreePrivacy, age_over_14: ageOver14, terms_version: TERMS_VERSION,
      });
      router.replace(safeNext(params.get('next'), '/mypage'));
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError('이미 가입된 이메일입니다.');
      else if (e instanceof ApiError && e.status === 429) setError('가입 시도가 너무 많습니다. 잠시 후 다시 시도해 주세요.');
      else if (e instanceof ApiError && e.status === 422) {
        setError(apiErrorMessage(e, { invalid: '입력값을 확인해 주세요(닉네임 2자 이상, 비밀번호 8자 이상).' }));
      }
      else setError('가입에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card style={{ maxWidth: 420, margin: '0 auto' }}>
      <form onSubmit={submit}>
        <div className="field">
          <label htmlFor="su-1">이메일</label>
          <input id="su-1" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required />
        </div>
        <div className="field">
          <label htmlFor="su-2">닉네임</label>
          <input id="su-2" type="text" value={nickname} onChange={(e) => setNickname(e.target.value)} autoComplete="nickname" minLength={2} maxLength={30} required />
        </div>
        <div className="field">
          <label htmlFor="su-3">비밀번호 <span className="tag">8자 이상</span></label>
          <input id="su-3" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" minLength={8} required />
        </div>
        <div className="field">
          <label htmlFor="su-4">비밀번호 확인</label>
          <input id="su-4"
            type="password" value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)}
            autoComplete="new-password" minLength={8} required
          />
        </div>
        {/* 개인정보 보호법상 수집 항목·목적·보관 기간을 동의받기 전에 알려야 해서 요약을 체크박스 아래에 둔다. */}
        <div className="consent-box">
          <label className="consent-all">
            <input type="checkbox" checked={allAgreed} onChange={(e) => setAll(e.target.checked)} />
            <span>아래 내용에 모두 동의합니다</span>
          </label>
          <label>
            <input type="checkbox" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} />
            <span>[필수] <Link href="/terms" target="_blank" rel="noopener">이용약관</Link>에 동의합니다</span>
          </label>
          <label>
            <input type="checkbox" checked={agreePrivacy} onChange={(e) => setAgreePrivacy(e.target.checked)} />
            <span>[필수] <Link href="/privacy" target="_blank" rel="noopener">개인정보 수집·이용</Link>에 동의합니다</span>
          </label>
          <div className="consent-summary">
            수집 항목: 이메일, 비밀번호, 닉네임 · 목적: 회원 식별과 로그인, 내가 쓴 글 관리 · 보관: 탈퇴 시 즉시 파기.
            동의하지 않으면 가입할 수 없지만, 평가와 게시글은 가입 없이도 작성할 수 있습니다.
          </div>
          <label>
            <input type="checkbox" checked={ageOver14} onChange={(e) => setAgeOver14(e.target.checked)} />
            <span>[필수] 만 14세 이상입니다</span>
          </label>
        </div>
        {error && <div className="warn">{error}</div>}
        <button className="btn lg" type="submit" style={{ width: '100%' }} disabled={submitting || !allAgreed}>
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
