import { notFound } from 'next/navigation';
import { AdminSupportReportDetail } from '@/components/admin/admin-support-report-detail';
import { findSupportReportByIdForAdmin } from '@/lib/data/support-reports';

type AdminSupportReportDetailPageProps = {
  readonly params: Promise<{ readonly reportId: string }>;
};

export async function generateMetadata(props: AdminSupportReportDetailPageProps) {
  const { reportId } = await props.params;
  return {
    title: `Support report ${reportId} — TeqMD Admin`,
  };
}

export default async function AdminSupportReportDetailPage(props: AdminSupportReportDetailPageProps) {
  const { reportId } = await props.params;
  const report = await findSupportReportByIdForAdmin(reportId);
  if (report === null) {
    notFound();
  }
  return <AdminSupportReportDetail report={report} />;
}
