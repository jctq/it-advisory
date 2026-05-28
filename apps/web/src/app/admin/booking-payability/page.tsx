import { redirect } from 'next/navigation';

type AdminBookingPayabilityRedirectPageProps = {
  readonly searchParams: Promise<{
    readonly reference?: string;
    readonly bookingReference?: string;
    readonly diagnostic?: string;
    readonly sessionId?: string;
  }>;
};

/** @deprecated Use /admin/debug */
export default async function AdminBookingPayabilityRedirectPage(
  props: AdminBookingPayabilityRedirectPageProps,
): Promise<never> {
  const searchParams = await props.searchParams;
  const nextParams = new URLSearchParams();
  const reference = searchParams.reference?.trim() ?? searchParams.bookingReference?.trim() ?? '';
  const diagnostic = searchParams.diagnostic?.trim() ?? searchParams.sessionId?.trim() ?? '';
  if (reference.length > 0) {
    nextParams.set('reference', reference);
  }
  if (diagnostic.length > 0) {
    nextParams.set('diagnostic', diagnostic);
  }
  const query = nextParams.toString();
  redirect(query.length > 0 ? `/admin/debug?${query}` : '/admin/debug');
}
