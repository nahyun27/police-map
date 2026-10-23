'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowUpRight, Heart, Link2, Trash2 } from 'lucide-react';
import { AdminBlindButton } from '@/components/AdminBlindButton';
import { ReportButton } from '@/components/ReportButton';
import { Card } from '@/components/ui';
import {
  ApiError, addCaseUpdate, addEmpathy, deleteCase, getCase, incrementCaseView, removeEmpathy, type CaseDetail,
} from '@/lib/api';
import { formatDate } from '@/lib/format';

export function CaseDetailView({ id, initial }: { id: number; initial: CaseDetail | null }) {
  const router = useRouter();
  const [c, setC] = useState<CaseDetail | null>(initial);
  const [missing, setMissing] = useState(false);
  const [empBusy, setEmpBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [update, setUpdate] = useState('');
  const [updBusy, setUpdBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    // 로그인 상태(공감 여부·작성자 여부·보류/블라인드 상태)를 반영하려고 쿠키를 실어 한 번 더 받는다.
    getCase(id).then(setC).catch(() => { if (!initial) setMissing(true); });
    incrementCaseView(id).catch(() => {});
  }, [id, initial]);

  if (missing) return <Card><p className="sub">사건을 찾을 수 없습니다. 삭제됐거나 비공개 상태일 수 있습니다.</p></Card>;
  if (!c) return <Card><p className="sub">불러오는 중…</p></Card>;

  const toggleEmpathy = async () => {
    setEmpBusy(true);
    setMsg(null);
    try {
      const r = c.my_empathy ? await removeEmpathy(c.id) : await addEmpathy(c.id);
      setC({ ...c, my_empathy: r.empathized, empathy_count: r.empathy_count });
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) router.push(`/login?next=/cases/${c.id}`);
      else setMsg('잠시 후 다시 시도해 주세요.');
    } finally { setEmpBusy(false); }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: c.title, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000); }
    } catch { /* 공유 취소 */ }
  };

  const submitUpdate = async () => {
    if (update.trim().length < 5) return;
    setUpdBusy(true);
    setMsg(null);
    try {
      const u = await addCaseUpdate(c.id, update.trim());
      setC({ ...c, updates: [...c.updates, u], update_count: c.update_count + 1 });
      setUpdate('');
    } catch (e) {
      const detail = e instanceof ApiError ? (e.body as { detail?: { message?: string } | string } | null)?.detail : null;
      setMsg(typeof detail === 'object' && detail?.message ? detail.message : '등록하지 못했습니다.');
    } finally { setUpdBusy(false); }
  };

  const remove = async () => {
    if (!confirm('이 사건을 삭제할까요? 되돌릴 수 없습니다.')) return;
    try { await deleteCase(c.id); router.replace('/cases'); } catch { setMsg('삭제하지 못했습니다.'); }
  };

  return (
    <>
      {c.is_mine && c.status === 'held' && (
        <div className="warn">
          <b>운영진 확인 후 공개됩니다.</b> {c.hold_reason}. 해당 내용을 지우고 새로 작성하시면 바로 공개됩니다.
        </div>
      )}
      {c.status === 'blinded' && (
        <div className="warn"><b>블라인드된 사건입니다.</b> {c.blind_reason}</div>
      )}

      <Card>
        <div className="flex" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
          <span className="badge cat-case">{c.category_label}</span>
          {c.station_name && c.station_id && <Link href={`/station/${c.station_id}`} className="sub">{c.station_name}</Link>}
        </div>
        <h1>{c.title}</h1>
        <p className="sub" style={{ marginTop: 6 }}>사건 #{c.id} · {formatDate(c.created_at)} · 조회 {c.view_count}</p>

        <div className="guidebox">
          <b>이 사건에 대해</b> 작성자의 경험과 주장을 게시한 글입니다. 공개는 게시 기준을 충족했다는 뜻일 뿐,
          내용의 진실성이나 위법성을 폴리스맵이 확인·판단했다는 뜻이 아닙니다.
        </div>

        <h3 style={{ marginTop: 18 }}>사건 경위</h3>
        <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, marginTop: 6 }}>{c.body}</p>
        {c.desired_action && (
          <>
            <h3 style={{ marginTop: 18 }}>작성자가 원하는 조치</h3>
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, marginTop: 6 }}>{c.desired_action}</p>
          </>
        )}

        <h3 style={{ marginTop: 22 }}>사건 진행 기록</h3>
        <ol className="case-timeline">
          <li><b>사건 기록</b><span className="sub">{formatDate(c.created_at)} · 작성자 진술</span></li>
          {c.updates.map((u) => (
            <li key={u.id}><span style={{ whiteSpace: 'pre-wrap' }}>{u.body}</span><span className="sub">{formatDate(u.created_at)} · 작성자 업데이트</span></li>
          ))}
        </ol>
        <p className="sub" style={{ fontSize: 12 }}>진행 기록은 모두 작성자가 직접 입력한 내용이며, 폴리스맵이 공식 문서로 확인한 것이 아닙니다.</p>

        {c.is_mine && c.status !== 'removed' && (
          <div style={{ marginTop: 12 }}>
            <textarea value={update} onChange={(e) => setUpdate(e.target.value)} maxLength={2000}
              placeholder="진행 상황을 덧붙여 주세요. 예: 국민신문고에 민원 접수, 기관 답변 수신 등"
              style={{ width: '100%', minHeight: 70, border: '1px solid var(--line)', borderRadius: 12, padding: 12, fontSize: 14 }} />
            <button className="btn sm" style={{ marginTop: 6 }} onClick={submitUpdate} disabled={updBusy || update.trim().length < 5}>진행 상황 추가</button>
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 22 }}>
          <button type="button" className={`btn ${c.my_empathy ? '' : 'line'}`} onClick={toggleEmpathy} disabled={empBusy || c.status !== 'published'}>
            <Heart size={16} fill={c.my_empathy ? 'currentColor' : 'none'} />공감 {c.empathy_count}
          </button>
          <button type="button" className="btn line" onClick={share}><Link2 size={16} />{copied ? '주소 복사됨' : '공유하기'}</button>
        </div>
        <p className="sub" style={{ marginTop: 6, fontSize: 12 }}>공감은 로그인 없이도 사건당 한 번 할 수 있으며, 사실 인정이나 법적 동의를 뜻하지 않습니다.</p>
        {msg && <div className="warn">{msg}</div>}

        <div className="btn-row" style={{ marginTop: 18, alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="btn-row" style={{ alignItems: 'center' }}>
            <ReportButton targetType="public_case" targetId={c.id} />
            <Link href={`/takedown/case/${c.id}`} className="sub">당사자 삭제·정정 요청</Link>
          </div>
          <div className="btn-row">
            <AdminBlindButton targetType="public_case" targetId={c.id} onDone={() => setC({ ...c, status: 'blinded' })} />
            {c.is_mine && <button type="button" className="btn line sm" onClick={remove}><Trash2 size={14} />삭제</button>}
          </div>
        </div>
      </Card>

      <Card className="tint">
        <h3>비슷한 문제를 겪고 계신가요?</h3>
        <p className="sub" style={{ margin: '4px 0 12px' }}>공감과 공유만으로는 문제가 해결되지 않습니다. 해당 문제에 맞는 공식 민원·권리구제 절차를 확인하세요.</p>
        <div className="btn-row">
          <Link href="/remedy" className="btn sm">권리구제 내비게이터 <ArrowUpRight size={14} /></Link>
          <Link href="/report" className="btn line sm">언론·감독기관 제보 안내</Link>
        </div>
      </Card>
    </>
  );
}
