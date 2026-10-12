import AdminShell from '@/components/admin/AdminShell';

// title·robots(noindex)는 부모 src/app/admin/layout.tsx 에서 /admin 하위 전체에 이미 적용된다.
// 페이지별 타이틀은 AdminShell 이 현재 경로에 맞춰 사이드바 라벨로 직접 보여준다.

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
