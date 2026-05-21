import type { ReactElement } from 'react';
import { MarketingAuthLegalNotice } from '@/components/marketing/legal/marketing-auth-legal-notice';
import { LoginForm } from '@/components/marketing/login-form';
import { resolveSafeInternalNextPath } from '@/lib/marketing/safe-internal-path';

type LoginPageProps = {
  readonly searchParams: Promise<{ readonly next?: string }>;
};

export default async function LoginPage(props: LoginPageProps): Promise<ReactElement> {
  const searchParams = await props.searchParams;
  const nextPath = resolveSafeInternalNextPath(searchParams.next);
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Sign in</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Accounts are optional. You can still run the full diagnostic as a guest — signing in saves progress across
          browsers when you use the same email.
        </p>
      </div>
      <div className="mx-auto mt-10 max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm">
        <LoginForm nextPath={nextPath} />
      </div>
      <div className="mx-auto mt-8">
        <MarketingAuthLegalNotice variant="login" />
      </div>
    </main>
  );
}
