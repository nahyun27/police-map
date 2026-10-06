import AdminGate from '@/components/admin/AdminGate';
import { PageHead } from '@/components/ui';

// title·robots(noindex)는 부모 src/app/admin/layout.tsx 에서 /admin 하위 전체에 이미 적용된다.

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHead eyebrow="관리자" title="운영 콘솔" />
      <AdminGate>{children}</AdminGate>
    </>
  );
}
