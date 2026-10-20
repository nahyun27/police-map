'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BadgeCheck, ClipboardCheck, FileX, Flag, Mail, Megaphone } from 'lucide-react';
import { TrafficPanel, UserStatsPanel } from '@/components/admin/StatsPanels';
import { Card } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { getAdminDashboard, type DashboardOut } from '@/lib/api';

const KIND_TONE: Record<string, string> = { review: 'brand', post: '', case: 'mid', signup: 'good', report: 'low' };

/** 관리자 첫 화면. 처리할 일을 먼저 보여 주고(0 건인 항목도 "없음"으로 남겨 확인했다는 감을 준다),
 * 그 아래에 방문·가입 통계와 사이트 최근 활동을 둔다. */
export default function AdminDashboardPage() {
  const [d, setD] = useState<DashboardOut | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => { getAdminDashboard().then(setD).catch(() => setError(true)); }, []);

  const tasks = d ? [
    { href: '/admin/reports', label: '처리 대기 신고', n: d.pending.reports, icon: Flag },
    {
      href: '/admin/takedowns', label: '삭제·정정 요청', n: d.pending.takedowns, icon: FileX,
      note: d.pending.takedowns_overdue ? `기한 넘김 ${d.pending.takedowns_overdue}건` : undefined,
    },
    { href: '/admin/officer-verifications', label: '경찰관 인증 신청', n: d.pending.verifications, icon: BadgeCheck },
    { href: '/admin/cases', label: '공개 보류 사건', n: d.pending.cases_held, icon: Megaphone },
    { href: '/admin/inquiries', label: '새 광고·제휴 문의', n: d.pending.inquiries, icon: Mail },
    ...(d.pending.reviews ? [{ href: '/admin/reviews', label: '검수 대기 평가', n: d.pending.reviews, icon: ClipboardCheck }] : []),
  ] : [];

  return (
    <>
      {error && <div className="warn">대시보드를 불러오지 못했습니다. 새로고침해 주세요.</div>}
      {d && (
        <>
          <Card>
            <h2>처리할 일</h2>
            <div className="admin-tasks">
              {tasks.map(({ href, label, n, icon: Icon, note }) => (
                <Link key={href} href={href} className={`admin-task${n ? ' has' : ''}`}>
                  <Icon size={18} />
                  <span className="lbl">{label}</span>
                  <b>{n ? `${n}건` : '없음'}</b>
                  {note && <span className="badge low">{note}</span>}
                </Link>
              ))}
            </div>
            <p className="sub" style={{ marginTop: 14 }}>
              누적: 평가 {d.totals.reviews.toLocaleString()} · 게시글 {d.totals.posts.toLocaleString()} ·
              사건 {d.totals.cases.toLocaleString()} · 회원 {d.totals.users.toLocaleString()}
            </p>
          </Card>
          <Card>
            <h2>최근 활동</h2>
            {d.recent.length ? (
              <ul className="admin-activity">
                {d.recent.map((a, i) => (
                  <li key={`${a.kind}-${i}`}>
                    <span className={`badge ${KIND_TONE[a.kind] ?? ''}`}>{a.kind_label}</span>
                    {a.link ? <Link href={a.link}>{a.text}</Link> : <span className="txt">{a.text}</span>}
                    <span className="sub">{formatDate(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="sub">아직 활동이 없습니다.</p>}
          </Card>
          <TrafficPanel />
          <UserStatsPanel />
        </>
      )}
      {!d && !error && <p className="sub">불러오는 중…</p>}
    </>
  );
}
