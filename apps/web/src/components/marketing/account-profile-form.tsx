'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState, type FormEvent, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  buildPhilippineMobileE164FromNationalDigits,
  normalizePhilippineMobileNationalDigits,
} from '@/lib/marketing/philippine-profile-phone';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';

const MOBILE_STICKY_HEADER_TOP_CLASS = 'top-14';

type AccountProfileFormInitial = {
  readonly email: string;
  readonly fullName: string;
  readonly company: string;
  readonly phoneNationalDigits: string;
};

type AccountProfileFormProps = {
  readonly initial: AccountProfileFormInitial;
};

type FieldErrors = {
  email?: string[];
  fullName?: string[];
  company?: string[];
  phone?: string[];
};

function extractFieldErrors(details: unknown): FieldErrors {
  if (typeof details !== 'object' || details === null) {
    return {};
  }
  const row = details as { fieldErrors?: Record<string, unknown> };
  if (row.fieldErrors === undefined || typeof row.fieldErrors !== 'object' || row.fieldErrors === null) {
    return {};
  }
  const out: FieldErrors = {};
  for (const key of ['email', 'fullName', 'company', 'phone'] as const) {
    const value = row.fieldErrors[key];
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) {
      out[key] = value as string[];
    }
  }
  return out;
}

/**
 * Client form for marketing account profile (name, email, company, Philippine mobile).
 */
export function AccountProfileForm(props: AccountProfileFormProps): ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState<string>(props.initial.email);
  const [fullName, setFullName] = useState<string>(props.initial.fullName);
  const [company, setCompany] = useState<string>(props.initial.company);
  const [phoneNationalDigits, setPhoneNationalDigits] = useState<string>(props.initial.phoneNationalDigits);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const executePhoneNationalChange = useCallback((raw: string): void => {
    setPhoneNationalDigits(normalizePhilippineMobileNationalDigits(raw));
  }, []);
  const executeSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setFieldErrors({});
      const phoneE164 = buildPhilippineMobileE164FromNationalDigits(phoneNationalDigits);
      if (phoneE164 === null) {
        setFieldErrors({ phone: ['Enter a 10-digit Philippine mobile number after +63 (starts with 9).'] });
        return;
      }
      setIsSubmitting(true);
      try {
        const response = await fetch('/api/auth/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email,
            fullName,
            company,
            phone: phoneE164,
          }),
        });
        const payload: unknown = await response.json();
        if (!response.ok) {
          if (typeof payload === 'object' && payload !== null && 'details' in payload) {
            setFieldErrors(extractFieldErrors((payload as { details: unknown }).details));
          }
          const message =
            typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
              ? (payload as { error: string }).error
              : 'Could not save your profile.';
          notifyError(message);
          return;
        }
        notifySuccess('Profile saved.');
        router.refresh();
      } finally {
        setIsSubmitting(false);
      }
    },
    [company, email, fullName, phoneNationalDigits, router],
  );
  return (
    <div className="md:mx-auto md:max-w-lg">
      <div
        className={cn(
          'sticky z-40 border-b border-border/80 bg-background/95 px-4 py-3 backdrop-blur md:hidden supports-backdrop-filter:bg-background/80',
          MOBILE_STICKY_HEADER_TOP_CLASS,
        )}
      >
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Profile</h1>
      </div>
      <div className="px-4 pb-10 pt-4 md:px-0 md:pb-0 md:pt-0">
        <div
          className={cn(
            'rounded-xl border border-border/60 bg-card/50 p-4 shadow-xs',
            'dark:border-border/50 dark:bg-card/35',
            'md:border-border md:bg-card md:p-6 md:shadow-sm',
          )}
        >
          <form className="flex flex-col gap-5" onSubmit={executeSubmit} noValidate>
            <div className="space-y-2">
              <label htmlFor="profile-full-name" className="text-sm font-medium text-foreground">
                Full name
              </label>
              <Input
                id="profile-full-name"
                name="fullName"
                type="text"
                autoComplete="name"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                aria-invalid={fieldErrors.fullName !== undefined}
              />
              {fieldErrors.fullName !== undefined ? (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.fullName[0]}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <label htmlFor="profile-email" className="text-sm font-medium text-foreground">
                Email
              </label>
              <Input
                id="profile-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={fieldErrors.email !== undefined}
              />
              {fieldErrors.email !== undefined ? (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.email[0]}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <label htmlFor="profile-company" className="text-sm font-medium text-foreground">
                Company
              </label>
              <Input
                id="profile-company"
                name="company"
                type="text"
                autoComplete="organization"
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                aria-invalid={fieldErrors.company !== undefined}
              />
              {fieldErrors.company !== undefined ? (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.company[0]}
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <span className="text-sm font-medium text-foreground">Mobile number</span>
              <p className="text-xs text-muted-foreground">
                Philippine mobile only. Typing 09… is normalized to 9… after +63.
              </p>
              <div className="flex w-full max-w-md rounded-md border border-input shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
                <span className="flex shrink-0 items-center border-r border-input bg-muted/60 px-3 text-sm font-medium text-muted-foreground">
                  +63
                </span>
                <Input
                  id="profile-phone-national"
                  name="phoneNational"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  className="border-0 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                  placeholder="9xx xxx xxxx"
                  value={phoneNationalDigits}
                  onChange={(event) => executePhoneNationalChange(event.target.value)}
                  aria-invalid={fieldErrors.phone !== undefined}
                />
              </div>
              {fieldErrors.phone !== undefined ? (
                <p className="text-sm text-destructive" role="alert">
                  {fieldErrors.phone[0]}
                </p>
              ) : null}
            </div>
            <Button type="submit" className="w-full md:w-auto" disabled={isSubmitting}>
              {isSubmitting ? 'Saving…' : 'Save'}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
