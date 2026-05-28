import { redirect } from 'next/navigation';

type AdminClientDiagnosticRedirectPageProps = {
  readonly searchParams: Promise<{
    readonly diagnostic?: string;
    readonly sessionId?: string;
    readonly reference?: string;
    readonly bookingReference?: string;
    readonly tab?: string;
  }>;
};

/** @deprecated Use /admin/debug */
export default async function AdminClientDiagnosticRedirectPage(
  props: AdminClientDiagnosticRedirectPageProps,
): Promise<never> {
  const searchParams = await props.searchParams;
  const nextParams = new URLSearchParams();
  const diagnostic = searchParams.diagnostic?.trim() ?? searchParams.sessionId?.trim() ?? '';
  const reference = searchParams.reference?.trim() ?? searchParams.bookingReference?.trim() ?? '';
  const tab = searchParams.tab?.trim();
  if (diagnostic.length > 0) {
    nextParams.set('diagnostic', diagnostic);
  }
  if (reference.length > 0) {
    nextParams.set('reference', reference);
  }
  if (tab === 'cron-logs') {
    nextParams.set('tab', 'cron-logs');
  }
  const query = nextParams.toString();
  redirect(query.length > 0 ? `/admin/debug?${query}` : '/admin/debug');
}
