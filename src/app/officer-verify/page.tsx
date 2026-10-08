'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { Card, Crumb, PageHead } from '@/components/ui';
import {
  ApiError, createVerification, getMe, getMyVerifications, getRegions, getRegion,
  type RegionDetail, type RegionOut, type StationItem, type VerifyOut,
} from '@/lib/api';

const STATUS_LABEL: Record<VerifyOut['status'], { label: string; tone: string }> = {
  pending: { label: '심사 대기 중', tone: 'mid' },
  approved: { label: '인증 완료', tone: 'good' },
  rejected: { label: '반려됨', tone: 'low' },
};

export default function OfficerVerifyPage() {
  const router = useRouter();
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [alreadyOfficer, setAlreadyOfficer] = useState<{ stationName: string; rank: string } | null>(null);
  const [mine, setMine] = useState<VerifyOut[]>([]);
  const [regions, setRegions] = useState<RegionOut[]>([]);
  const [regionId, setRegionId] = useState('');
  const [stations, setStations] = useState<StationItem[]>([]);
  const [stationId, setStationId] = useState('');
  const [name, setName] = useState('');
  const [rank, setRank] = useState('');
  const [department, setDepartment] = useState('');
  const [contact, setContact] = useState('');
  const [proofNote, setProofNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const load = useCallback(() => {
    setLoadState('loading');
    getMe()
      .then(async (me) => {
        if (me.officer_station_id && me.officer_station_name) {
          setAlreadyOfficer({ stationName: me.officer_station_name, rank: me.officer_rank ?? '' });
        }
        const [regs, requests] = await Promise.all([getRegions(), getMyVerifications()]);
        setRegions(regs);
        setMine(requests);
        setLoadState('ready');
      })
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) { router.replace('/login?next=/officer-verify'); return; }
        setLoadState('error');
      });
  }, [router]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    setStationId('');
    if (!regionId) { setStations([]); return; }
    let cancelled = false;
    getRegion(regionId).then((r: RegionDetail) => { if (!cancelled) setStations(r.stations); }).catch(() => setStations([]));
    return () => { cancelled = true; };
  }, [regionId]);

  const pendingExists = mine.some((v) => v.status === 'pending');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createVerification({
        station_id: Number(stationId), name: name.trim(), rank: rank.trim(),
        department: department.trim() || null, contact: contact.trim(), proof_note: proofNote.trim() || null,
      });
      setDone(true);
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setError('이미 인증되었거나 심사 대기 중인 신청이 있습니다.');
      else setError('신청에 실패했습니다. 입력값을 확인해 주세요.');
      setSubmitting(false);
    }
  };

  if (loadState === 'loading') return <Card><p className="sub">불러오는 중…</p></Card>;
  if (loadState === 'error') {
    return (
      <Card>
        <p className="warn">정보를 불러오지 못했습니다. 네트워크 상태를 확인하고 다시 시도해 주세요.</p>
        <button className="btn line sm" style={{ marginTop: 10 }} onClick={load}>다시 시도</button>
      </Card>
    );
  }

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: '경찰관 신원 인증' }]} />
      <PageHead
        eyebrow="경찰관 전용"
        title="경찰관 신원 인증 신청"
        sub="인증되면 소속 경찰서에 달린 평가에 공식 해명을 남길 수 있습니다. 서류 업로드 없이, 관리자가 소속 확인 후 수동으로 승인합니다."
      />

      {alreadyOfficer ? (
        <Card className="tint">
          <div style={{ display: 'flex', gap: 14 }}>
            <ShieldCheck size={22} style={{ color: 'var(--brand)', marginTop: 2 }} />
            <div>
              <h3>이미 인증된 계정입니다</h3>
              <p className="sub" style={{ marginTop: 6 }}>{alreadyOfficer.stationName} 소속으로 인증되어 있어요({alreadyOfficer.rank}). 해당 경찰서 평가에서 해명을 작성할 수 있습니다.</p>
            </div>
          </div>
        </Card>
      ) : done || pendingExists ? (
        <Card className="tint">
          <h3>심사 대기 중입니다</h3>
          <p className="sub" style={{ marginTop: 6 }}>신청 내용을 관리자가 확인(소속 경찰서 대표번호 등으로 확인)한 뒤 승인 여부를 반영합니다.</p>
        </Card>
      ) : (
        <Card>
          <form onSubmit={submit}>
            <div className="field">
              <label>소속 지역</label>
              <select className="sel" style={{ width: '100%' }} value={regionId} onChange={(e) => setRegionId(e.target.value)} required>
                <option value="">지역 선택</option>
                {regions.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>소속 경찰서</label>
              <select className="sel" style={{ width: '100%' }} value={stationId} onChange={(e) => setStationId(e.target.value)} required disabled={!regionId}>
                <option value="">경찰서 선택</option>
                {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="field">
              <label>성명</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} minLength={2} maxLength={50} required />
            </div>
            <div className="field">
              <label>계급</label>
              <input type="text" value={rank} onChange={(e) => setRank(e.target.value)} placeholder="예: 경위" maxLength={30} required />
            </div>
            <div className="field">
              <label>부서 <span className="tag">선택</span></label>
              <input type="text" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="예: 수사과" maxLength={100} />
            </div>
            <div className="field">
              <label>연락처 <span className="tag">비공개</span></label>
              <input
                type="text" value={contact} onChange={(e) => setContact(e.target.value)} maxLength={200} required
                placeholder="예: kim@police.go.kr (경찰 공식 메일이면 확인이 더 빠릅니다)"
              />
            </div>
            <div className="field">
              <label>확인 방법 메모 <span className="tag">선택</span></label>
              <input
                type="text" value={proofNote} onChange={(e) => setProofNote(e.target.value)} maxLength={300}
                placeholder="예: 소속 경찰서 대표번호로 확인 요망"
              />
            </div>
            {error && <div className="warn">{error}</div>}
            <button className="btn lg" type="submit" disabled={submitting || !stationId}>
              {submitting ? '제출 중…' : '인증 신청'}
            </button>
          </form>
        </Card>
      )}

      {mine.length > 0 && !pendingExists && (
        <Card className="flat">
          <h3>신청 내역</h3>
          {mine.map((v) => (
            <div key={v.id} className="review">
              <div className="meta">
                <span className={`badge ${STATUS_LABEL[v.status].tone}`}>{STATUS_LABEL[v.status].label}</span>
                {v.station_name} · {v.rank}
              </div>
              {v.status === 'rejected' && v.reject_reason && <p className="sub">반려 사유: {v.reject_reason}</p>}
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
