'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useState, type FormEvent, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { notifyError } from '@/lib/notify';

type LoginFormProps = {
  readonly nextPath: string;
};

const CHECKBOX_ROW_CLASS = 'flex cursor-pointer items-start gap-3 text-sm leading-5 text-muted-foreground';

/**
 * Client form for marketing-site sign-in.
 */
export function LoginForm(props: LoginFormProps): ReactElement {
  const router = useRouter();
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [mergeGuestProgress, setMergeGuestProgress] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const executeSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault();
      setIsSubmitting(true);
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, mergeGuestProgress }),
        });
        const payload: unknown = await response.json();
        if (!response.ok) {
          const message =
            typeof payload === 'object' && payload !== null && 'error' in payload && typeof (payload as { error?: unknown }).error === 'string'
              ? (payload as { error: string }).error
              : 'Sign-in failed.';
          notifyError(message);
          return;
        }
        router.push(props.nextPath);
        router.refresh();
      } finally {
        setIsSubmitting(false);
      }
    },
    [email, mergeGuestProgress, password, props.nextPath, router],
  );
  return (
    <form className="mx-auto flex w-full max-w-md flex-col gap-5" onSubmit={executeSubmit} noValidate>
      <div className="space-y-2">
        <label htmlFor="login-email" className="text-sm font-medium text-foreground">
          Email
        </label>
        <Input
          id="login-email"
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
        <label htmlFor="login-password" className="text-sm font-medium text-foreground">
          Password
        </label>
        <Input
          id="login-password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      <label className={CHECKBOX_ROW_CLASS}>
        <Checkbox
          checked={mergeGuestProgress}
          className="mt-0.5"
          onCheckedChange={(checked) => setMergeGuestProgress(checked === true)}
        />
        <span className="min-w-0">Move diagnostic and booking activity from this browser onto my signed-in profile.</span>
      </label>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Signing in…' : 'Sign in'}
      </Button>
      <p className="text-center text-sm text-muted-foreground">
        No account?{' '}
        <Link href="/register" className="font-medium text-primary underline-offset-4 hover:underline">
          Create one
        </Link>
        {' · '}
        <Link href="/diagnostic" className="font-medium text-primary underline-offset-4 hover:underline">
          Continue as guest
        </Link>
      </p>
    </form>
  );
}
