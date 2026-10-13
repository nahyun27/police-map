'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Check, MapPin, Megaphone, MousePointerClick, Send } from 'lucide-react';
import { Card } from '@/components/ui';
import { ApiError, createInquiry, type InquiryType } from '@/lib/api';

const TYPES: [InquiryType, string][] = [['ad', '광고 문의'], ['partnership', '제휴·비즈니스'], ['other', '기타']];

const POINTS = [
  { icon: MapPin, title: '지역 타겟 광고', body: '시·도 단위로 그 지역 페이지와 관할 경찰서 페이지에만 노출할 수 있어요. 전국 노출도 가능합니다.' },
  { icon: Megaphone, title: '눈에 띄는 자리', body: 'PC에서는 본문 양옆 고정 배너, 모바일에서는 본문 하단 배너로 노출됩니다. 권리구제 페이지 광고란도 있어요.' },
  { icon: MousePointerClick, title: '성과 확인', body: '노출 수와 클릭 수를 집계해 알려 드립니다.' },
];

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    if (e.status === 429) return '잠시 후 다시 시도해 주세요.';
    const detail = (e.body as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string') return detail;
    return '입력값을 확인해 주세요. 연락처는 5자 이상, 문의 내용은 10자 이상이어야 합니다.';
  }
  return '접수에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

export default function AdvertisePage() {
  const [type, setType] = useState<InquiryType>('ad');
  const [company, setCompany] = useState('');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [region, setRegion] = useState('');
  const [message, setMessage] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 광고 자리의 "이 자리에 광고하세요"에서 들어오면 지역을 미리 채운다(?region=제주).
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('region');
    if (r) setRegion(r);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!agreed) { setError('개인정보 수집·이용에 동의해 주세요.'); return; }
    setBusy(true);
    setError(null);
    try {
      const r = await createInquiry({ inquiry_type: type, company, name, contact, region_interest: region || null, message, agreed });
      setDone(r.message);
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <>
      <section className="card hero compact hero-bleed">
        <div className="eyebrow">광고·제휴</div>
        <h1>폴리스맵과 함께하세요</h1>
        <p className="lead">
          경찰서를 찾고, 평가를 읽고, 권리구제 절차를 알아보는 사람들이 모이는 곳입니다. 지역 단위 광고와 제휴·비즈니스
          문의를 받습니다.
        </p>
      </section>

      <div className="grid3">
        {POINTS.map(({ icon: Icon, title, body }) => (
          <Card key={title} className="feature">
            <div className="ico"><Icon size={20} /></div>
            <h3>{title}</h3>
            <p className="sub">{body}</p>
          </Card>
        ))}
      </div>

      <Card className="tint">
        <b>광고 운영 원칙</b>{' '}모든 광고에는 &quot;광고&quot; 표시가 붙고, 평가·순위 등 콘텐츠에는 어떤 영향도 주지 않습니다.
        폴리스맵은 특정 사건이나 변호사를 알선·소개하지 않으며, 정액 광고료 외 어떠한 대가도 받지 않습니다
        (<Link href="/policy">운영원칙</Link>).
      </Card>

      <Card>
        <h2>문의하기</h2>
        {done ? (
          <div className="guidebox" style={{ display: 'flex', gap: 8, alignItems: 'center' }}><Check size={18} />{done}</div>
        ) : (
          <form onSubmit={submit}>
            <div className="field">
              <label>문의 유형</label>
              <div className="seg">
                {TYPES.map(([v, l]) => (
                  <button key={v} type="button" className={type === v ? 'active' : ''} onClick={() => setType(v)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="grid2" style={{ marginBottom: 0 }}>
              <div className="field">
                <label>회사·단체명</label>
                <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={100} required />
              </div>
              <div className="field">
                <label>담당자 이름</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={50} required />
              </div>
              <div className="field">
                <label>연락처(이메일 또는 전화번호)</label>
                <input type="text" value={contact} onChange={(e) => setContact(e.target.value)} minLength={5} maxLength={100} required />
              </div>
              <div className="field">
                <label>관심 지역 <span className="tag">선택</span></label>
                <input type="text" value={region} onChange={(e) => setRegion(e.target.value)} maxLength={50} placeholder="예: 제주, 전국" />
              </div>
            </div>
            <div className="field">
              <label>문의 내용</label>
              <textarea value={message} onChange={(e) => setMessage(e.target.value)} minLength={10} maxLength={3000} required
                placeholder="광고하려는 내용, 희망 기간·지역, 예산 등을 적어 주세요." />
            </div>
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13.5, color: 'var(--ink2)', marginBottom: 14 }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: 'auto', marginTop: 4 }} />
              <span>
                문의 답변을 위해 회사·단체명, 담당자 이름, 연락처를 수집·이용하는 데 동의합니다. 수집한 정보는 문의 답변과 광고
                상담에만 쓰고, 상담이 끝나면 지체 없이 파기합니다.
              </span>
            </label>
            {error && <div className="warn">{error}</div>}
            <button className="btn lg" type="submit" disabled={busy || !agreed}><Send size={16} />{busy ? '보내는 중…' : '문의 보내기'}</button>
          </form>
        )}
      </Card>
    </>
  );
}
