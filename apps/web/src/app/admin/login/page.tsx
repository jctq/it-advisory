import { Button } from '@/components/ui/button';
import { buildApiUrl } from '@/lib/config/build-api-url';

type SearchParams = { readonly next?: string; readonly error?: string };

export const metadata = {
  title: 'Admin sign in — IT Advisory',
};

export default async function AdminLoginPage(props: {
  readonly searchParams: Promise<SearchParams>;
}) {
  const params = await props.searchParams;
  const adminLoginAction = buildApiUrl('/api/admin/login');
  const next =
    typeof params.next === 'string' && params.next.length > 0 ? params.next : '/admin/diagnostic-templates';
  const errorMessage = resolveErrorMessage(params.error);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-6 py-12">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">Internal</p>
        <h1 className="text-2xl font-semibold tracking-tight">Admin sign in</h1>
        <p className="text-sm text-muted-foreground">
          Paste the shared admin token. Set as <code className="font-mono">ADMIN_TOKEN</code> on the
          server.
        </p>
      </header>
      {errorMessage !== null && (
        <div
          role="alert"
          className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
        >
          {errorMessage}
        </div>
      )}
      <form
        action={adminLoginAction}
        method="post"
        className="flex flex-col gap-3 rounded-lg border bg-card p-4 shadow-xs"
      >
        <input type="hidden" name="next" value={next} />
        <label htmlFor="token" className="text-sm font-medium">
          Admin token
        </label>
        <input
          id="token"
          name="token"
          type="password"
          autoComplete="current-password"
          required
          className="flex h-9 w-full rounded-md border bg-background px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] dark:bg-input/30 dark:border-input"
        />
        <Button type="submit" size="default">
          Sign in
        </Button>
      </form>
    </main>
  );
}

function resolveErrorMessage(code: string | undefined): string | null {
  if (code === 'invalid') {
    return 'Invalid admin token.';
  }
  if (code === 'missing') {
    return 'Token is required.';
  }
  if (code === 'unset') {
    return 'ADMIN_TOKEN is not configured on the server.';
  }
  return null;
}
