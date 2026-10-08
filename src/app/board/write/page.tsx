'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { Card, Crumb, PageHead } from '@/components/ui';
import {
  ApiError, createPost, getRegion, getRegions,
  type PostCategory, type RegionDetail, type RegionOut, type StationItem,
} from '@/lib/api';

const CATEGORY_OPTIONS: [PostCategory, string][] = [
  ['info', '정보공유'], ['question', '질문'], ['chat', '잡담'], ['other', '기타'],
];

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
  // 글쓰기 버튼을 눌렀을 때 전체 화면이 "불러오는 중"에 막혀 있다가 지역 목록 호출이
  // 조금이라도 실패하면 아예 폼 자체를 못 보여주던 문제를 고쳤다. 이제 폼은 항상 바로
  // 뜨고, 지역 목록은 그 위에서 따로 불러온다. 실패해도 이 칸 하나만 재시도하면 된다.
  const [regionsState, setRegionsState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [regions, setRegions] = useState<RegionOut[]>([]);
  const [regionId, setRegionId] = useState('');
  const [stations, setStations] = useState<StationItem[]>([]);
  const [stationId, setStationId] = useState('');
  const [category, setCategory] = useState<PostCategory>('chat');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRegions = useCallback(() => {
    setRegionsState('loading');
    getRegions()
      .then((rs) => { setRegions(rs); setRegionsState('ready'); })
      .catch(() => setRegionsState('error'));
  }, []);

  useEffect(() => { loadRegions(); }, [loadRegions]);

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
        region_id: regionId || null, station_id: stationId ? Number(stationId) : null, category,
        title: title.trim(), body: body.trim(),
      });
      router.replace(`/board/${r.id}`);
    } catch (e) {
      setError(errorMessage(e));
      setSubmitting(false);
    }
  };

  return (
    <>
      <Crumb items={[{ label: '홈', to: '/' }, { label: '커뮤니티 게시판', to: '/board' }, { label: '글쓰기' }]} />
      <PageHead
        eyebrow="커뮤니티"
        title="자유 게시판 글쓰기"
        sub="작성 즉시 공개됩니다. 로그인 없이 익명으로도 쓸 수 있고, 사실 적시 비방·욕설은 삭제될 수 있어요."
      />

      <Card>
        <form onSubmit={submit}>
          <div className="field">
            <label>지역 <span className="tag">선택</span></label>
            {regionsState === 'error' ? (
              <div className="warn" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                지역 목록을 불러오지 못했습니다.
                <button type="button" className="btn line sm" onClick={loadRegions}>다시 시도</button>
              </div>
            ) : (
              <select
                className="sel" style={{ width: '100%' }} value={regionId} onChange={(e) => setRegionId(e.target.value)}
                disabled={regionsState === 'loading'}
              >
                <option value="">{regionsState === 'loading' ? '불러오는 중…' : '지역 지정 안 함(자유 주제)'}</option>
                {regions.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
              </select>
            )}
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
            <label>글머리</label>
            <select className="sel" style={{ width: '100%' }} value={category} onChange={(e) => setCategory(e.target.value as PostCategory)}>
              {CATEGORY_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </div>
          <div className="field">
            <label>제목</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} minLength={2} maxLength={200} required />
          </div>
          <div className="field">
            <label>내용</label>
            <textarea value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} required />
          </div>
          {error && <div className="warn">{error}</div>}
          <button className="btn lg" type="submit" disabled={submitting}>
            <Send size={16} />{submitting ? '등록 중…' : '게시하기'}
          </button>
        </form>
      </Card>
    </>
  );
}
