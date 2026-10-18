'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldAlert, Send } from 'lucide-react';
import { Card, Crumb, PageHead } from '@/components/ui';
import {
  apiErrorMessage, CASE_CATEGORIES, createCase, getMe, getRegion, getRegions,
  type CaseCategory, type RegionOut, type StationItem,
} from '@/lib/api';

function errorMessage(e: unknown): string {
  return apiErrorMessage(e, {
    fallback: '등록에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    invalid: '입력값을 확인해 주세요. 제목은 5자, 내용은 30자 이상이어야 합니다.',
    byStatus: { 429: '오늘은 더 이상 등록할 수 없습니다(하루 5건). 내일 다시 시도해 주세요.' },
  });
}

export default function NewCasePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [regions, setRegions] = useState<RegionOut[]>([]);
  const [regionId, setRegionId] = useState('');
  const [stations, setStations] = useState<StationItem[]>([]);
  const [stationId, setStationId] = useState('');
  const [category, setCategory] = useState<CaseCategory>('delay');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [desired, setDesired] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 작성은 로그인 회원만(2026-10 결정). 비로그인이면 로그인 후 이 화면으로 돌아오게 한다.
  useEffect(() => {
    getMe().then(() => setReady(true)).catch(() => router.replace('/login?next=/cases/new'));
    getRegions().then(setRegions).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setStationId('');
    if (!regionId) { setStations([]); return; }
    let cancelled = false;
    getRegion(regionId).then((r) => { if (!cancelled) setStations(r.stations); }).catch(() => setStations([]));
    return () => { cancelled = true; };
  }, [regionId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!agreed) { setError('게시 전 확인 사항에 동의해 주세요.'); return; }
    setError(null);
    setSubmitting(true);
    try {
      const r = await createCase({
        category, title: title.trim(), body: body.trim(), desired_action: desired.trim() || null,
        station_id: stationId ? Number(stationId) : null, agreed,
      });
      router.replace(`/cases/${r.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setSubmitting(false);
    }
  };

  if (!ready) return <p className="sub" style={{ padding: 24 }}>확인 중…</p>;

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: '사건 공론화', to: '/cases' }, { label: '사건 기록하기' }]} />
      <PageHead eyebrow="사건 공론화" title="사건 기록하기" sub="작성 즉시 공개됩니다. 다만 개인정보로 보이는 내용이 있으면 운영진 확인 후 공개됩니다." />

      <Card>
        <form onSubmit={submit}>
          <div className="field">
            <label>어떤 문제를 겪으셨나요?</label>
            <select className="sel" style={{ width: '100%' }} value={category} onChange={(e) => setCategory(e.target.value as CaseCategory)}>
              {CASE_CATEGORIES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="grid2" style={{ marginBottom: 0 }}>
            <div className="field">
              <label>지역 <span className="tag">선택</span></label>
              <select className="sel" style={{ width: '100%' }} value={regionId} onChange={(e) => setRegionId(e.target.value)}>
                <option value="">지정 안 함</option>
                {regions.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>관할 경찰서 <span className="tag">선택</span></label>
              <select className="sel" style={{ width: '100%' }} value={stationId} onChange={(e) => setStationId(e.target.value)} disabled={!regionId}>
                <option value="">지정 안 함</option>
                {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field">
            <label>사건 제목</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} minLength={5} maxLength={120} required
              placeholder="무슨 일이 있었는지 간단하게 (5자 이상)" />
          </div>
          <div className="field">
            <label>어떤 일이 있었나요?</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} minLength={30} maxLength={5000} required
              placeholder="일시(대략적인 시기), 겪은 절차, 직접 확인한 사실을 중심으로 작성해 주세요. (30자 이상)" />
          </div>
          <div className="field">
            <label>어떤 조치를 원하시나요? <span className="tag">선택</span></label>
            <textarea value={desired} onChange={(e) => setDesired(e.target.value)} maxLength={1000} style={{ minHeight: 80 }}
              placeholder="예: 처리 경과에 대한 설명, 절차 확인, 공식 답변 등" />
          </div>

          <div className="guidebox">
            <b style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ShieldAlert size={15} />공개 전 확인 사항</b>
            <ul style={{ margin: '6px 0 0 18px' }}>
              <li>수사관 실명, 사건번호, 연락처, 피해자·참고인 등 다른 사람을 알아볼 수 있는 정보는 쓰지 마세요. 경찰서와 날짜만으로도 담당자가 특정될 수 있으니 주의해 주세요.</li>
              <li>직접 겪은 사실만 쓰고, 확인되지 않은 내용을 범죄나 비리로 단정하지 마세요. 허위 사실은 명예훼손 책임이 생길 수 있습니다.</li>
              <li>신고가 쌓이거나 운영원칙에 어긋나면 블라인드될 수 있고, 그 사유는 마이페이지에서 확인할 수 있습니다.</li>
            </ul>
            <label style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, fontWeight: 650 }}>
              <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} style={{ width: 'auto' }} />
              위 내용을 확인했습니다.
            </label>
          </div>

          {error && <div className="warn">{error}</div>}
          <button className="btn lg" type="submit" disabled={submitting || !agreed}>
            <Send size={16} />{submitting ? '등록 중…' : '사건 기록하기'}
          </button>
        </form>
      </Card>
    </>
  );
}
