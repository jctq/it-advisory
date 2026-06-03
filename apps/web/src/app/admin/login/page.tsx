import { AdminLoginButtons } from '@/components/admin/admin-login-buttons';
import { resolveAdminAuthErrorPresentation } from '@/lib/admin/resolve-admin-auth-error';
import { buildApiUrl } from '@/lib/config/build-api-url';

type SearchParams = { readonly next?: string; readonly error?: string };

export const metadata = {
  title: 'Admin sign in — TeqMD',
};

export default async function AdminLoginPage(props: {
  readonly searchParams: Promise<SearchParams>;
}) {
  const params = await props.searchParams;
  const next =
    typeof params.next === 'string' && params.next.length > 0 ? params.next : '/admin/diagnostic-templates';
  const errorPresentation = resolveAdminAuthErrorPresentation(params.error);
  const hasGoogle =
    (process.env.AUTH_GOOGLE_ID?.trim().length ?? 0) > 0 &&
    (process.env.AUTH_GOOGLE_SECRET?.trim().length ?? 0) > 0;
  const hasMicrosoft =
    (process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim().length ?? 0) > 0 &&
    (process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim().length ?? 0) > 0;
  const logoutUrl = buildApiUrl('/api/admin/logout');
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <header className="space-y-1 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Admin sign in</h1>
        <p className="text-sm text-muted-foreground">Sign in with your approved work account.</p>
      </header>
      {errorPresentation !== null ? (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <p className="font-medium text-destructive">{errorPresentation.title}</p>
          <p className="mt-1 leading-relaxed text-destructive/90">{errorPresentation.message}</p>
        </div>
      ) : null}
      <div className="rounded-lg border bg-card p-4 shadow-xs">
        <AdminLoginButtons next={next} hasGoogle={hasGoogle} hasMicrosoft={hasMicrosoft} />
      </div>
    </main>
  );
}
