'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type FormEvent, type ReactElement, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { MarketingLegalDialog } from '@/components/marketing/legal/marketing-legal-dialog';
import type { LegalDocumentId } from '@/lib/marketing/legal-document-id';
import { notifyError } from '@/lib/notify';

type RegisterFormProps = {
  readonly nextPath: string;
  readonly privacyPolicyContent: ReactNode;
  readonly termsOfUseContent: ReactNode;
};

function LegalDocumentButton(props: {
  readonly documentId: LegalDocumentId;
  readonly label: string;
  readonly onOpen: (documentId: LegalDocumentId) => void;
}): ReactElement {
  return (
    <button
      type="button"
      className="inline h-auto align-baseline p-0 font-medium text-primary underline-offset-2 hover:underline"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        props.onOpen(props.documentId);
      }}
    >
      {props.label}
    </button>
  );
}

const CHECKBOX_ROW_CLASS = 'flex cursor-pointer items-start gap-3 text-sm leading-5 text-muted-foreground';

/**
 * Client form for marketing-site registration.
 */
export function RegisterForm(props: RegisterFormProps): ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [mergeGuestProgress, setMergeGuestProgress] = useState<boolean>(true);
  const [hasAcceptedLegalTerms, setHasAcceptedLegalTerms] = useState<boolean>(false);
  const [openDocumentId, setOpenDocumentId] = useState<LegalDocumentId | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const openLegalDocument = useCallback((documentId: LegalDocumentId): void => {
    setOpenDocumentId(documentId);
  }, []);
  const handleDialogOpenChange = useCallback((open: boolean): void => {
    if (!open) {
      setOpenDocumentId(null);
    }
  }, []);
  const executeSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      if (!hasAcceptedLegalTerms) {
        notifyError('You must accept the Terms of Use and Privacy Policy.');
        return;
      }
      setIsSubmitting(true);
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, mergeGuestProgress, acceptedLegalTerms: true }),
        });
        const payload: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
              ? (payload as { error: string }).error
              : 'Registration failed.';
          notifyError(message);
          return;
        }
        router.push(props.nextPath);
        router.refresh();
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, hasAcceptedLegalTerms, mergeGuestProgress, password, props.nextPath, router],
  );
  return (
    <form className="mx-auto flex w-full max-w-md flex-col gap-5" onSubmit={executeSubmit} noValidate>
      <div className="space-y-2">
        <label htmlFor="register-email" className="text-sm font-medium text-foreground">
          Email
        </label>
        <Input
          id="register-email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label htmlFor="register-password" className="text-sm font-medium text-foreground">
          Password
        </label>
        <Input
          id="register-password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <p className="text-xs text-muted-foreground">Use at least 8 characters.</p>
      </div>
      <label className={CHECKBOX_ROW_CLASS}>
        <Checkbox
          checked={mergeGuestProgress}
          className="mt-0.5"
          onCheckedChange={(checked) => setMergeGuestProgress(checked === true)}
        />
        <span className="min-w-0">Move diagnostic and booking activity from this browser onto my new account.</span>
      </label>
      <label className={CHECKBOX_ROW_CLASS}>
        <Checkbox
          checked={hasAcceptedLegalTerms}
          className="mt-0.5"
          onCheckedChange={(checked) => setHasAcceptedLegalTerms(checked === true)}
        />
        <span className="min-w-0">
          I agree to the <LegalDocumentButton documentId="terms-of-use" label="Terms of Use" onOpen={openLegalDocument} />{' '}
          and <LegalDocumentButton documentId="privacy-policy" label="Privacy Policy" onOpen={openLegalDocument} />.
        </span>
      </label>
      <Button type="submit" className="w-full" disabled={isSubmitting || !hasAcceptedLegalTerms}>
        {isSubmitting ? 'Creating account…' : 'Create account'}
      </Button>
      <MarketingLegalDialog
        documentId={openDocumentId}
        onOpenChange={handleDialogOpenChange}
        privacyPolicyContent={props.privacyPolicyContent}
        termsOfUseContent={props.termsOfUseContent}
      />
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
          Sign in
        </Link>
        {' · '}
        <Link href="/diagnostic" className="font-medium text-primary underline-offset-4 hover:underline">
          Continue as guest
        </Link>
      </p>
    </form>
  );
}
