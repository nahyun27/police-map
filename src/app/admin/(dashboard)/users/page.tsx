'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { Ban, FileText, RotateCcw, Search } from 'lucide-react';
import { Card, TableWrap } from '@/components/ui';
import { formatDate } from '@/lib/format';
import {
  ApiError, getAdminUserContent, listAdminUsers, suspendAdminUser, unsuspendAdminUser,
  type AdminUser, type AdminUserContentItem, type AdminUserStatus, type Page,
} from '@/lib/api';

const STATUS_TABS: ['all' | AdminUserStatus, string][] = [
  ['all', '전체'], ['active', '정상'], ['suspended', '정지'], ['withdrawn', '탈퇴'],
];
const STATUS_BADGE: Record<AdminUserStatus, [string, string]> = {
  active: ['정상', 'good'], suspended: ['정지', 'low'], withdrawn: ['탈퇴', ''],
};
const STATE_LABEL: Record<string, string> = {
  published: '공개', removed: '삭제', blinded: '블라인드', held: '보류', pending: '대기', rejected: '반려',
};

function errMsg(e: unknown) {
  if (e instanceof ApiError) {
    const d = (e.body as { detail?: unknown } | null)?.detail;
    if (typeof d === 'string') return d;
  }
  return '처리하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

/** 회원 관리. 이용약관 제6조의 "회원 자격 정지"를 실제로 하는 곳이다. 정지하면 바로 로그아웃되고 로그인이 막히며,
 * 정지·해제·작성 글 열람은 모두 처리 기록에 남는다. 이미 쓴 글은 그대로라 문제 글은 신고·블라인드에서 따로 처리한다. */
export default function AdminUsersPage() {
  const [status, setStatus] = useState<'all' | AdminUserStatus>('all');
  const [q, setQ] = useState('');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<AdminUser> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<number | null>(null);
  const [content, setContent] = useState<AdminUserContentItem[] | null>(null);

  // 탭·검색을 빠르게 바꿀 때 늦게 도착한 이전 응답이 목록을 덮어쓰지 않게 가장 최근 요청만 반영한다.
  const seq = useRef(0);
  const load = useCallback(() => {
    const mySeq = ++seq.current;
    listAdminUsers({ q: query, status, page })
      .then((d) => { if (seq.current === mySeq) setData(d); })
      .catch(() => { if (seq.current === mySeq) setError('목록을 불러오지 못했습니다.'); });
  }, [query, status, page]);
  useEffect(() => { load(); }, [load]);
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;

  const changeStatus = (v: 'all' | AdminUserStatus) => { setStatus(v); setPage(1); setData(null); setError(null); };
  const search = (e: FormEvent) => { e.preventDefault(); setQuery(q); setPage(1); };

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); load(); } catch (e) { setError(errMsg(e)); }
  };
  const suspend = (u: AdminUser) => {
    const reason = prompt(`${u.nickname}(${u.email}) 회원을 이용 정지합니다. 정지 사유를 적어 주세요.\n예: 욕설·비방 글 반복 게시`);
    if (reason === null) return;
    if (reason.trim().length < 2) { setError('정지 사유를 2자 이상 적어 주세요.'); return; }
    act(() => suspendAdminUser(u.id, reason.trim()));
  };
  const unsuspend = (u: AdminUser) => {
    if (confirm(`${u.nickname} 회원의 이용 정지를 해제할까요?`)) act(() => unsuspendAdminUser(u.id));
  };
  const toggleContent = async (u: AdminUser) => {
    if (openId === u.id) { setOpenId(null); return; }
    setOpenId(u.id);
    setContent(null);
    try { setContent(await getAdminUserContent(u.id)); } catch (e) { setError(errMsg(e)); setContent([]); }
  };

  return (
    <>
      <div className="admin-toolbar">
        <div className="seg">
          {STATUS_TABS.map(([v, l]) => (
            <button key={v} type="button" className={status === v ? 'active' : ''} aria-pressed={status === v} onClick={() => changeStatus(v)}>{l}</button>
          ))}
        </div>
        <form onSubmit={search} className="hsearch" style={{ marginLeft: 0 }}>
          <Search size={16} />
          <input
            value={q} onChange={(e) => setQ(e.target.value)} placeholder="닉네임·이메일 검색" aria-label="회원 검색" maxLength={100}
            style={{ background: '#fff', width: 260 }}
          />
        </form>
      </div>
      <Card>
        {error && <div className="warn" style={{ marginBottom: 16 }}>{error}</div>}
        <TableWrap>
          <table className="list">
            <thead>
              <tr><th>회원</th><th>가입일</th><th>작성</th><th>받은 신고</th><th>상태</th><th>처리</th></tr>
            </thead>
            <tbody>
              {data === null ? (
                <tr><td colSpan={6} className="sub">불러오는 중…</td></tr>
              ) : data.items.length === 0 ? (
                <tr><td colSpan={6} className="sub">해당하는 회원이 없습니다.</td></tr>
              ) : data.items.map((u) => {
                const [label, tone] = STATUS_BADGE[u.status];
                return [
                  <tr key={u.id}>
                    <td>
                      <b>{u.nickname}</b>
                      {u.role === 'admin' && <span className="badge brand" style={{ marginLeft: 6 }}>관리자</span>}
                      {u.officer_verified && <span className="badge" style={{ marginLeft: 6 }}>경찰관 인증</span>}
                      <div className="sub" style={{ wordBreak: 'break-all' }}>{u.status === 'withdrawn' ? '(탈퇴로 파기됨)' : u.email}</div>
                    </td>
                    <td className="sub">{formatDate(u.created_at)}</td>
                    <td className="sub">평가 {u.review_count} · 글 {u.post_count} · 댓글 {u.comment_count}{u.case_count ? ` · 사건 ${u.case_count}` : ''}</td>
                    <td>{u.reports_received ? <b style={{ color: 'var(--low)' }}>{u.reports_received}건</b> : <span className="sub">0</span>}</td>
                    <td>
                      <span className={`badge ${tone}`}>{label}</span>
                      {u.suspend_reason && <div className="sub" style={{ marginTop: 4 }}>{u.suspend_reason}</div>}
                    </td>
                    <td>
                      <div className="btn-row">
                        <button className="btn line sm" onClick={() => toggleContent(u)}><FileText size={14} />작성 글</button>
                        {u.status === 'active' && u.role !== 'admin' && (
                          <button className="btn line sm danger" onClick={() => suspend(u)}><Ban size={14} />정지</button>
                        )}
                        {u.status === 'suspended' && (
                          <button className="btn line sm" onClick={() => unsuspend(u)}><RotateCcw size={14} />정지 해제</button>
                        )}
                      </div>
                    </td>
                  </tr>,
                  openId === u.id && (
                    <tr key={`${u.id}-content`}>
                      <td colSpan={6} style={{ background: 'var(--bg)' }}>
                        {content === null ? <span className="sub">불러오는 중…</span> : content.length === 0 ? (
                          <span className="sub">작성한 글이 없습니다.</span>
                        ) : (
                          <ul className="admin-user-content">
                            {content.map((c) => (
                              <li key={`${c.kind}-${c.id}`}>
                                <span className="badge">{c.kind_label}</span>
                                {c.state !== 'published' && <span className="badge low">{STATE_LABEL[c.state] ?? c.state}</span>}
                                {c.link ? <Link href={c.link} target="_blank">{c.text}</Link> : <span>{c.text}</span>}
                                <span className="sub">{formatDate(c.created_at)}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>
        </TableWrap>
        {totalPages > 1 && (
          <div className="btn-row" style={{ marginTop: 16, alignItems: 'center' }}>
            {page > 1 && <button className="btn line sm" onClick={() => setPage((p) => p - 1)}>이전</button>}
            <span className="sub">{page} / {totalPages} ({data?.total}명)</span>
            {page < totalPages && <button className="btn line sm" onClick={() => setPage((p) => p + 1)}>다음</button>}
          </div>
        )}
      </Card>
    </>
  );
}
