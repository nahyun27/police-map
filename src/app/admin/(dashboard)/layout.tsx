import AdminGate from '@/components/admin/AdminGate';
import { PageHead } from '@/components/ui';
import { NOINDEX } from '@/lib/seo';

export const metadata = { title: '운영 콘솔', robots: NOINDEX };

export default function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <PageHead eyebrow="관리자" title="운영 콘솔" />
      <AdminGate>{children}</AdminGate>
    </>
  );
}
