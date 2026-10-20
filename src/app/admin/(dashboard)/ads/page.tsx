'use client';

import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Pause, Pencil, Play, Plus, Trash2 } from 'lucide-react';
import { Card } from '@/components/ui';
import {
  ApiError, apiAsset, createAdminAd, deleteAdminAd, editAdminAd, getRegions, listAdminAds, updateAdminAd,
  type AdminAd, type RegionOut,
} from '@/lib/api';

function errMsg(e: unknown) {
  if (e instanceof ApiError) {
    const d = (e.body as { detail?: unknown } | null)?.detail;
    if (typeof d === 'string') return d;
  }
  return '처리하지 못했습니다. 입력값을 확인해 주세요.';
}

/** 배너 파일 칸. 수정 모드에서는 지금 등록된 배너를, 새 파일을 고르면 그 파일을 미리 보여 줘서
 * "비워 두면 유지, 고르면 교체"가 화면만 보고도 드러나게 한다. */
function BannerField({ name, label, currentUrl, required, removable }: {
  name: 'image_wide' | 'image_side'; label: string; currentUrl?: string | null; required?: boolean; removable?: boolean;
}) {
  const [picked, setPicked] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);
  useEffect(() => () => { if (picked) URL.revokeObjectURL(picked); }, [picked]);
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    setPicked(f ? URL.createObjectURL(f) : null);
  };
  const preview = picked ?? (remove ? null : currentUrl ? apiAsset(currentUrl) : null);
  const caption = picked ? '새 파일로 교체됩니다' : remove ? '저장하면 세로 배너가 없어집니다' : currentUrl ? '지금 등록된 배너(파일을 고르지 않으면 그대로 유지)' : null;
  return (
    <div className="field">
      <label>{label}</label>
      {(preview || caption) && (
        <div className="banner-preview">
          {/* eslint-disable-next-line @next/next/no-img-element -- 관리자 미리보기 */}
          {preview && <img src={preview} alt="" className={name === 'image_side' ? 'side' : 'wide'} />}
          {caption && <span className="sub">{caption}</span>}
        </div>
      )}
      <input type="file" name={name} accept="image/png,image/jpeg,image/webp" required={required} onChange={onPick} />
      {removable && currentUrl && (
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontWeight: 500, fontSize: 13, marginTop: 6 }}>
          <input type="checkbox" name="remove_side" value="true" style={{ width: 'auto' }} checked={remove} onChange={(e) => setRemove(e.target.checked)} />
          세로 배너 없애기(넓은 PC 화면 양옆에 표시 안 함, 가로 배너만 노출)
        </label>
      )}
    </div>
  );
}

/** 등록·수정 공용 폼. ad 를 주면 수정 모드: 현재 값을 채워 두고, 배너는 새 파일을 고른 것만 교체한다. */
function AdForm({ ad, regions, onSubmit, onCancel, busy }: {
  ad?: AdminAd; regions: RegionOut[]; busy: boolean;
  onSubmit: (form: FormData) => void; onCancel?: () => void;
}) {
  const editing = !!ad;
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    for (const k of ['image_wide', 'image_side']) if (!(form.get(k) as File | null)?.size) form.delete(k);
    // 등록은 빈 칸을 빼고 보낸다. 수정은 빈 칸도 "전국·무기한으로 비움"이라는 뜻이라 빼면 같은 결과가 된다
    // (서버가 보내지 않은 지역·기간을 비운 것으로 처리).
    for (const k of ['starts_on', 'ends_on', 'region_id']) if (!form.get(k)) form.delete(k);
    onSubmit(form);
  };
  return (
    <form onSubmit={submit} style={{ marginTop: 16 }}>
      <div className="grid2" style={{ marginBottom: 0 }}>
        <div className="field"><label>광고 이름(관리용)</label><input name="title" required maxLength={100} defaultValue={ad?.title} placeholder="예: 제주갈치상회 10월" /></div>
        <div className="field"><label>광고주</label><input name="advertiser" required maxLength={100} defaultValue={ad?.advertiser} placeholder="화면에 '광고 · 광고주'로 표시" /></div>
        <div className="field"><label>링크(클릭 시 이동)</label><input name="link_url" required maxLength={500} defaultValue={ad?.link_url} placeholder="https://" /></div>
        <div className="field">
          <label>노출 지역</label>
          <select name="region_id" className="sel" style={{ width: '100%' }} defaultValue={ad?.region_id ?? ''}>
            <option value="">전국</option>
            {regions.map((r) => <option key={r.id} value={r.id}>{r.full_name}</option>)}
          </select>
        </div>
        <div className="field"><label>시작일 <span className="tag">선택</span></label><input type="date" name="starts_on" defaultValue={ad?.starts_on ?? ''} /></div>
        <div className="field"><label>종료일 <span className="tag">선택</span></label><input type="date" name="ends_on" defaultValue={ad?.ends_on ?? ''} /></div>
        <BannerField
          name="image_wide" label={`가로 배너(${editing ? '바꿀 때만 선택' : '필수'}, 권장 1200×300)`}
          currentUrl={ad?.image_wide_url} required={!editing}
        />
        <BannerField name="image_side" label="세로 배너(선택, 권장 160×600)" currentUrl={ad?.image_side_url} removable />
      </div>
      <div className="btn-row">
        <button className="btn" type="submit" disabled={busy}>{busy ? '저장 중…' : editing ? '수정 저장' : '등록'}</button>
        {onCancel && <button className="btn line" type="button" onClick={onCancel}>취소</button>}
      </div>
    </form>
  );
}

/** 광고 관리. 결제·계약은 사이트 밖에서 하고, 여기서는 배너 이미지·링크·지역·기간만 등록한다.
 * 가로형 이미지는 필수(본문 하단·모바일·권리구제 광고란), 세로형은 선택(넓은 PC 화면 양옆). */
export default function AdminAdsPage() {
  const [ads, setAds] = useState<AdminAd[] | null>(null);
  const [regions, setRegions] = useState<RegionOut[]>([]);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => { listAdminAds().then(setAds).catch(() => setError('목록을 불러오지 못했습니다.')); }, []);
  useEffect(() => { load(); getRegions().then(setRegions).catch(() => {}); }, [load]);

  const save = async (fn: () => Promise<unknown>, done: () => void) => {
    setBusy(true);
    setError(null);
    try { await fn(); done(); load(); } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); load(); } catch (err) { setError(errMsg(err)); }
  };

  return (
    <>
      <Card>
        <div className="btn-row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <p className="sub" style={{ margin: 0 }}>
            광고는 경찰서 상세 페이지(양옆·하단)와 권리구제 광고란에 나옵니다. 지역을 고르면 그 지역 경찰서에 우선, &quot;전국&quot;이면 지역 광고가 없는 경찰서에 노출됩니다.
          </p>
          <button className="btn sm" onClick={() => setOpen((v) => !v)}><Plus size={14} />광고 등록</button>
        </div>
        {open && (
          <AdForm regions={regions} busy={busy} onSubmit={(f) => save(() => createAdminAd(f), () => setOpen(false))} />
        )}
        {error && <div className="warn" style={{ marginTop: 12 }}>{error}</div>}
      </Card>

      <Card>
        {ads === null ? <p className="sub">불러오는 중…</p> : ads.length ? ads.map((a) => {
          const ctr = a.impressions ? ((a.clicks / a.impressions) * 100).toFixed(1) : '0.0';
          return (
            <div className="review" key={a.id}>
              <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 16, alignItems: 'start' }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- 관리자 미리보기 */}
                <img src={apiAsset(a.image_wide_url)} alt={a.title} style={{ width: '100%', borderRadius: 10, border: '1px solid var(--line)' }} />
                <div>
                  <div className="meta">
                    <span className={`badge ${a.is_live ? 'good' : ''}`}>{a.is_live ? '노출 중' : a.is_active ? '기간 외' : '중지됨'}</span>
                    <span className="badge">{a.region_name ?? '전국'}</span>
                    {a.image_side_url && <span className="badge">세로 배너 있음</span>}
                  </div>
                  <b>{a.title}</b> <span className="sub">· {a.advertiser}</span>
                  <p className="sub" style={{ marginTop: 4, wordBreak: 'break-all' }}>{a.link_url}</p>
                  <p className="sub">기간: {a.starts_on ?? '즉시'} ~ {a.ends_on ?? '무기한'} · 노출 {a.impressions.toLocaleString()} · 클릭 {a.clicks.toLocaleString()} (클릭률 {ctr}%)</p>
                  <div className="btn-row" style={{ marginTop: 8 }}>
                    <button className="btn line sm" onClick={() => setEditingId(editingId === a.id ? null : a.id)}>
                      <Pencil size={14} />수정
                    </button>
                    <button className="btn line sm" onClick={() => act(() => updateAdminAd(a.id, { is_active: !a.is_active }))}>
                      {a.is_active ? <><Pause size={14} />중지</> : <><Play size={14} />재개</>}
                    </button>
                    <button className="btn line sm danger" onClick={() => { if (confirm('광고를 삭제할까요? 노출·클릭 기록도 함께 사라집니다.')) act(() => deleteAdminAd(a.id)); }}>
                      <Trash2 size={14} />삭제
                    </button>
                  </div>
                </div>
              </div>
              {editingId === a.id && (
                <AdForm
                  ad={a} regions={regions} busy={busy}
                  onSubmit={(f) => save(() => editAdminAd(a.id, f), () => setEditingId(null))}
                  onCancel={() => setEditingId(null)}
                />
              )}
            </div>
          );
        }) : <p className="sub">등록된 광고가 없습니다. 위의 &quot;광고 등록&quot;으로 추가하세요.</p>}
      </Card>
    </>
  );
}
