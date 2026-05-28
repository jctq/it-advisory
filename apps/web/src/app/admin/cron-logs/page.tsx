import { redirect } from 'next/navigation';

/** @deprecated Use /admin/debug?tab=cron-logs */
export default function AdminCronLogsRedirectPage(): never {
  redirect('/admin/debug?tab=cron-logs');
}
