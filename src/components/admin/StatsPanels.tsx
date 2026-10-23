'use client';

import { useEffect, useState } from 'react';
import { Activity, Eye, ShieldPlus, Smartphone, UserPlus, Users } from 'lucide-react';
import { Card } from '@/components/ui';
import { getAdminTraffic, getAdminUserStats, type TrafficOut, type UserStatsOut } from '@/lib/api';

/** 방문 통계(자체 수집, 쿠키·외부 도구 없음). 방문자는 "날마다 서로 다른 사람 수"의 합이라, 같은 사람이 이틀 오면 2명으로 센다. */
export function TrafficPanel() {
  const [t, setT] = useState<TrafficOut | null>(null);
  useEffect(() => { getAdminTraffic().then(setT).catch(() => {}); }, []);
  if (!t) return null;
  const max = Math.max(1, ...t.daily.map((d) => d.visitors));
  const kpi = (label: string, s: { visitors: number; pageviews: number }) => (
    <Card className="kpi stat flat">
      <div className="ico"><Eye size={19} /></div>
      <div>
        <div className="num">{s.visitors.toLocaleString()}</div>
        <div className="lbl">{label} 방문자 · 페이지뷰 {s.pageviews.toLocaleString()}</div>
      </div>
    </Card>
  );
  return (
    <Card>
      <h2><Activity size={17} style={{ verticalAlign: -3, marginRight: 5, color: 'var(--brand)' }} />방문 통계</h2>
      <div className="grid3 grid4">
        {kpi('오늘', t.today)}
        {kpi('어제', t.yesterday)}
        {kpi('최근 7일', t.last_7d)}
        {kpi('최근 30일', t.last_30d)}
      </div>
      <p className="sub" style={{ marginTop: 18, marginBottom: 8 }}>최근 14일 일별 방문자</p>
      <div className="admin-spark">
        {t.daily.map((d) => (
          <div key={d.day} className="admin-spark-bar" title={`${d.day} · 방문자 ${d.visitors}명 · 페이지뷰 ${d.pageviews}`}>
            <i style={{ height: `${Math.max(4, (d.visitors / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="grid2" style={{ marginTop: 18, marginBottom: 0 }}>
        <div>
          <p className="sub" style={{ marginBottom: 6 }}>많이 본 페이지(최근 7일)</p>
          {t.top_pages.length ? (
            <ol className="admin-rank">{t.top_pages.map(([p, n]) => <li key={p}><span>{p}</span><b>{n.toLocaleString()}</b></li>)}</ol>
          ) : <p className="sub">아직 기록이 없습니다.</p>}
        </div>
        <div>
          <p className="sub" style={{ marginBottom: 6 }}>
            들어온 경로(최근 7일) · <Smartphone size={12} style={{ verticalAlign: -1 }} /> 모바일 {Math.round(t.mobile_ratio * 100)}%
          </p>
          {t.top_referrers.length ? (
            <ol className="admin-rank">{t.top_referrers.map(([h, n]) => <li key={h}><span>{h}</span><b>{n.toLocaleString()}</b></li>)}</ol>
          ) : <p className="sub">외부 사이트에서 들어온 기록이 아직 없습니다(주소 직접 입력·즐겨찾기는 집계되지 않음).</p>}
        </div>
      </div>
    </Card>
  );
}

/** 가입 회원 현황. */
export function UserStatsPanel() {
  const [stats, setStats] = useState<UserStatsOut | null>(null);

  useEffect(() => { getAdminUserStats().then(setStats).catch(() => {}); }, []);

  if (!stats) return null;
  const max = Math.max(1, ...stats.daily_signups.map(([, c]) => c));

  return (
    <Card>
      <h2><Users size={17} style={{ verticalAlign: -3, marginRight: 5, color: 'var(--brand)' }} />가입 회원 현황</h2>
      <div className="grid3">
        <Card className="kpi stat flat">
          <div className="ico"><Users size={19} /></div>
          <div><div className="num">{stats.total_users.toLocaleString()}</div><div className="lbl">전체 가입자</div></div>
        </Card>
        <Card className="kpi stat flat">
          <div className="ico"><UserPlus size={19} /></div>
          <div>
            <div className="num">{stats.new_7d.toLocaleString()}</div>
            <div className="lbl">최근 7일 신규 가입(30일 {stats.new_30d.toLocaleString()}명)</div>
          </div>
        </Card>
        <Card className="kpi stat flat">
          <div className="ico"><ShieldPlus size={19} /></div>
          <div><div className="num">{stats.officer_verified.toLocaleString()}</div><div className="lbl">경찰관 인증 완료</div></div>
        </Card>
      </div>
      <p className="sub" style={{ marginTop: 18, marginBottom: 8 }}>최근 14일 일별 가입</p>
      <div className="admin-spark">
        {stats.daily_signups.map(([day, count]) => (
          <div key={day} className="admin-spark-bar" title={`${day} · ${count}명`}>
            <i style={{ height: `${Math.max(4, (count / max) * 100)}%` }} />
          </div>
        ))}
      </div>
    </Card>
  );
}

