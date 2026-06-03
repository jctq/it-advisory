import { AdminAuthErrorPanel } from '@/components/admin/admin-auth-error-panel';
import {
  normalizeAdminAuthErrorCode,
  resolveAdminAuthErrorPresentation,
} from '@/lib/admin/resolve-admin-auth-error';

export const metadata = {
  title: 'Admin sign-in issue — TeqMD',
  robots: { index: false, follow: false },
};

type SearchParams = { readonly error?: string };

export default async function AdminAuthErrorPage(props: {
  readonly searchParams: Promise<SearchParams>;
}) {
  const params = await props.searchParams;
  const errorCode = normalizeAdminAuthErrorCode(params.error);
  const presentation =
    resolveAdminAuthErrorPresentation(params.error) ?? {
      title: 'Could not sign in',
      message:
        'We could not complete your sign-in. Please try again. If the problem continues, contact your administrator.',
    };
  return <AdminAuthErrorPanel presentation={presentation} errorCode={errorCode} />;
}
