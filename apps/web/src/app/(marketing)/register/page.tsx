import type { ReactElement } from 'react';
import Link from 'next/link';
import { RegisterForm } from '@/components/marketing/register-form';
import { resolveSafeInternalNextPath } from '@/lib/marketing/safe-internal-path';

type RegisterPageProps = {
  readonly searchParams: Promise<{ readonly next?: string }>;
};

export default async function RegisterPage(props: RegisterPageProps): Promise<ReactElement> {
  const searchParams = await props.searchParams;
  const nextPath = resolveSafeInternalNextPath(searchParams.next);
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto max-w-lg text-center">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Optional account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Create an account</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Register if you want your diagnostic history tied to an email. Guests can use every step of the diagnostic
          without an account.
        </p>
      </div>
      <div className="mx-auto mt-10 max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm">
        <RegisterForm nextPath={nextPath} />
      </div>
      <p className="mx-auto mt-8 max-w-lg text-center text-xs text-muted-foreground">
        We store a salted password hash only — never the plaintext password.{' '}
        <Link href="/" className="text-primary underline-offset-2 hover:underline">
          Back to home
        </Link>
      </p>
    </main>
  );
}
