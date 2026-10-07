'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { Card, Crumb, PageHead } from '@/components/ui';
import {
  ApiError, createPost, getMe, getRegion, getRegions,
  type RegionDetail, type RegionOut, type StationItem,
} from '@/lib/api';

function errorMessage(e: unknown): string {
  if (e instanceof ApiError) {
    const detail = (e.body as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string') return detail;
    if (detail && typeof detail === 'object' && 'message' in detail) return String((detail as { message: unknown }).message);
    return '입력값을 확인해 주세요.';
  }
  return '등록에 실패했습니다. 잠시 후 다시 시도해 주세요.';
}

export default function BoardWritePage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [regions, setRegions] = useState<RegionOut[]>([]);
  const [regionId, setRegionId] = useState('');
  const [stations, setStations] = useState<StationItem[]>([]);
  const [stationId, setStationId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then(() => getRegions().then((rs) => { setRegions(rs); setReady(true); }))
      .catch((e) => {
        if (e instanceof ApiError && e.status === 401) router.replace('/login?next=/board/write');
        else setError('정보를 불러오지 못했습니다.');
      });
  }, [router]);

  useEffect(() => {
    setStationId('');
    if (!regionId) { setStations([]); return; }
    let cancelled = false;
    getRegion(regionId).then((r: RegionDetail) => { if (!cancelled) setStations(r.stations); }).catch(() => setStations([]));
    return () => { cancelled = true; };
  }, [regionId]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const r = await createPost({
        region_id: regionId, station_id: stationId ? Number(stationId) : null, title: title.trim(), body: body.trim(),
      });
      router.replace(`/board/${r.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setSubmitting(false);
    }
  };

  if (!ready) return <Card><p className="sub">불러오는 중…</p></Card>;

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: '커뮤니티 게시판', to: '/board' }, { label: '글쓰기' }]} />
      <PageHead eyebrow="커뮤니티" title="자유 게시판 글쓰기" sub="작성 즉시 공개됩니다. 사실 적시 비방·욕설은 삭제될 수 있어요." />

      <Card>
        <form onSubmit={submit}>
          <div className="field">
            <label>지역</label>
            <select className="sel" style={{ width: '100%' }} value={regionId} onChange={(e) => setRegionId(e.target.value)} required>
              <option value="">지역 선택</option>
              {regions.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
            </select>
          </div>
          {regionId && (
            <div className="field">
              <label>경찰서 <span className="tag">선택</span></label>
              <select className="sel" style={{ width: '100%' }} value={stationId} onChange={(e) => setStationId(e.target.value)}>
                <option value="">특정 경찰서 지정 안 함</option>
                {stations.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
          <div className="field">
            <label>제목</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} minLength={2} maxLength={200} required />
          </div>
          <div className="field">
            <label>내용</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} required />
          </div>
          {error && <div className="warn">{error}</div>}
          <button className="btn lg" type="submit" disabled={submitting || !regionId}>
            <Send size={16} />{submitting ? '등록 중…' : '게시하기'}
          </button>
        </form>
      </Card>
    </>
  );
}
