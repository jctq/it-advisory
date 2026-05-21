import type { ReactElement } from 'react';
import { MarketingAuthLegalNotice } from '@/components/marketing/legal/marketing-auth-legal-notice';
import { buildNoIndexMetadata } from '@/lib/seo/site-seo';
import { PrivacyPolicyContent } from '@/components/marketing/legal/privacy-policy-content';
import { TermsOfUseContent } from '@/components/marketing/legal/terms-of-use-content';
import { RegisterForm } from '@/components/marketing/register-form';
import { resolveSafeInternalNextPath } from '@/lib/marketing/safe-internal-path';

type RegisterPageProps = {
  readonly searchParams: Promise<{ readonly next?: string }>;
};

export const metadata = buildNoIndexMetadata({
  title: 'Create an account · TechMD',
  description: 'Register to tie your diagnostic history to your email.',
});

export default async function RegisterPage(props: RegisterPageProps): Promise<ReactElement> {
  const searchParams = await props.searchParams;
  const nextPath = resolveSafeInternalNextPath(searchParams.next);
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto max-w-lg text-center">
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Create an account</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Register if you want your diagnostic history tied to an email. Guests can use every step of the diagnostic
          without an account.
        </p>
      </div>
      <div className="mx-auto mt-10 max-w-lg rounded-xl border border-border bg-card p-6 shadow-sm">
        <RegisterForm nextPath={nextPath} />
      </div>
      <div className="mx-auto mt-8">
        <MarketingAuthLegalNotice
          variant="register"
          privacyPolicyContent={<PrivacyPolicyContent />}
          termsOfUseContent={<TermsOfUseContent />}
        />
      </div>
    </main>
  );
}
