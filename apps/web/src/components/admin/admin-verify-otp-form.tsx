'use client';

import { REGEXP_ONLY_DIGITS } from 'input-otp';
import { Loader2, Mail, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from '@/components/ui/input-otp';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { cn } from '@/lib/utils';

const DEFAULT_NEXT_PATH = '/admin/diagnostic-templates';
const RESEND_COOLDOWN_SECONDS = 60 as const;
const OTP_EXPIRY_MINUTES = 10 as const;

const OTP_SLOT_CLASSNAME =
  'size-11 rounded-lg border border-input bg-background text-lg font-semibold tabular-nums shadow-sm transition-colors first:rounded-lg first:border-l last:rounded-lg last:border-r dark:bg-background/80';

type AdminVerifyOtpFormProps = {
  readonly email: string;
  readonly initialSendFailed: boolean;
  readonly initialResendLocked: boolean;
};

export function AdminVerifyOtpForm(props: AdminVerifyOtpFormProps): React.ReactElement {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update } = useSession();
  const otpFieldId = useId();
  const otpErrorId = useId();
  const otpHintId = useId();
  const [code, setCode] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(
    props.initialSendFailed
      ? 'We could not send a verification email. Try resending the code below.'
      : null,
  );
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSending, setIsSending] = useState<boolean>(false);
  const [resendSeconds, setResendSeconds] = useState<number>(
    props.initialResendLocked ? RESEND_COOLDOWN_SECONDS : 0,
  );
  const nextPath =
    searchParams.get('next')?.startsWith('/admin') === true &&
    !searchParams.get('next')!.startsWith('//')
      ? searchParams.get('next')!
      : DEFAULT_NEXT_PATH;
  const executeSendCode = useCallback(async (): Promise<void> => {
    setIsSending(true);
    setErrorMessage(null);
    try {
      const response = await fetch(buildApiUrl('/api/admin/otp/send'), { method: 'POST' });
      const payload = (await response.json().catch(() => null)) as {
        readonly error?: string;
        readonly code?: string;
      } | null;
      if (!response.ok) {
        if (payload?.code === 'admin_otp_cooldown') {
          const retryAfter = Number.parseInt(response.headers.get('Retry-After') ?? '', 10);
          setResendSeconds(
            Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : RESEND_COOLDOWN_SECONDS,
          );
        }
        setErrorMessage(payload?.error ?? 'Unable to send verification code. Please try again.');
        return;
      }
      setResendSeconds(RESEND_COOLDOWN_SECONDS);
    } catch {
      setErrorMessage('Unable to send verification code. Please try again.');
    } finally {
      setIsSending(false);
    }
  }, []);
  useEffect(() => {
    if (resendSeconds <= 0) {
      return;
    }
    const timer = window.setTimeout(() => {
      setResendSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => {
      window.clearTimeout(timer);
    };
  }, [resendSeconds]);
  const executeVerify = useCallback(
    async (submittedCode: string = code): Promise<void> => {
      if (submittedCode.length !== 6) {
        setErrorMessage('Enter the full 6-digit code from your email.');
        return;
      }
      setIsSubmitting(true);
      setErrorMessage(null);
      try {
        const response = await fetch(buildApiUrl('/api/admin/otp/verify'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: submittedCode }),
        });
        const payload = (await response.json().catch(() => null)) as {
          readonly error?: string;
        } | null;
        if (!response.ok) {
          setErrorMessage(
            payload?.error ??
              'That code is invalid or has expired. Request a new code and try again.',
          );
          return;
        }
        await update();
        router.replace(nextPath);
        router.refresh();
      } catch {
        setErrorMessage('Unable to verify your code right now. Please try again.');
      } finally {
        setIsSubmitting(false);
      }
    },
    [code, nextPath, router, update],
  );
  const canResend = !isSending && resendSeconds <= 0 && !isSubmitting;
  const resendLabel =
    resendSeconds > 0 ? `Resend available in ${resendSeconds} seconds` : 'Resend verification code';
  return (
    <Card className="w-full border bg-card shadow-sm">
      <CardHeader className="space-y-4 pb-2 text-center">
        <div
          className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          aria-hidden
        >
          <Mail className="size-6" />
        </div>
        <div className="space-y-2">
          <CardTitle className="text-2xl font-semibold tracking-tight">Check your email</CardTitle>
          <CardDescription className="text-pretty leading-relaxed">
            We sent a 6-digit verification code to complete your admin sign-in.
          </CardDescription>
        </div>
        <p className="inline-flex max-w-full items-center rounded-full border bg-muted/40 px-3 py-1.5 text-sm font-medium text-foreground">
          <span className="truncate">{props.email}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        {errorMessage !== null ? (
          <div
            id={otpErrorId}
            role="alert"
            className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2.5 text-sm text-destructive"
          >
            {errorMessage}
          </div>
        ) : null}
        <div className="space-y-3">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <Label htmlFor={otpFieldId} className="text-sm font-medium text-foreground">
              Verification code
            </Label>
            <p id={otpHintId} className="text-xs text-muted-foreground">
              Expires in {OTP_EXPIRY_MINUTES} minutes
            </p>
          </div>
          <InputOTP
            id={otpFieldId}
            maxLength={6}
            pattern={REGEXP_ONLY_DIGITS}
            inputMode="tel"
            autoComplete="one-time-code"
            autoFocus
            textAlign="center"
            value={code}
            onChange={(value) => {
              setCode(value);
              if (errorMessage !== null) {
                setErrorMessage(null);
              }
            }}
            onComplete={(value) => {
              void executeVerify(value);
            }}
            aria-invalid={errorMessage !== null}
            aria-describedby={[otpHintId, errorMessage !== null ? otpErrorId : null]
              .filter(Boolean)
              .join(' ')}
            disabled={isSubmitting}
            containerClassName="justify-center"
          >
            <InputOTPGroup className="gap-2">
              <InputOTPSlot index={0} className={OTP_SLOT_CLASSNAME} />
              <InputOTPSlot index={1} className={OTP_SLOT_CLASSNAME} />
              <InputOTPSlot index={2} className={OTP_SLOT_CLASSNAME} />
            </InputOTPGroup>
            <InputOTPSeparator className="mx-1 text-muted-foreground" />
            <InputOTPGroup className="gap-2">
              <InputOTPSlot index={3} className={OTP_SLOT_CLASSNAME} />
              <InputOTPSlot index={4} className={OTP_SLOT_CLASSNAME} />
              <InputOTPSlot index={5} className={OTP_SLOT_CLASSNAME} />
            </InputOTPGroup>
          </InputOTP>
          <div className="flex flex-col items-center gap-2">
            <p className="text-center text-xs text-muted-foreground">
              Tap a box to focus, then use your keyboard&apos;s delete key to correct a digit. You
              can also paste the code from your email.
            </p>
            {code.length > 0 ? (
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-11 px-2 text-xs text-muted-foreground"
                disabled={isSubmitting}
                onClick={() => {
                  setCode('');
                  setErrorMessage(null);
                }}
              >
                Clear code
              </Button>
            ) : null}
          </div>
        </div>
        <div className="flex justify-center">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-11 gap-2 px-3 text-muted-foreground hover:text-foreground"
            disabled={!canResend}
            onClick={() => void executeSendCode()}
            aria-label={resendLabel}
          >
            <RefreshCw className={cn('size-4 shrink-0', isSending && 'animate-spin')} aria-hidden />
            <span aria-live="polite" className="tabular-nums">
              {isSending
                ? 'Sending code…'
                : resendSeconds > 0
                  ? `Resend in ${resendSeconds}s`
                  : 'Resend code'}
            </span>
          </Button>
        </div>
      </CardContent>
      <CardFooter className="flex flex-col gap-4 border-t pt-6">
        <Button
          type="button"
          className="h-11 w-full"
          disabled={isSubmitting || code.length !== 6}
          onClick={() => void executeVerify()}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              Verifying…
            </>
          ) : (
            'Continue to admin'
          )}
        </Button>
        <p className="text-center text-sm text-muted-foreground">
          Wrong account?{' '}
          <Link
            href="/admin/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in with a different email
          </Link>
        </p>
        <p className="text-center text-xs text-muted-foreground">
          Need help?{' '}
          <a
            href="mailto:support@teqmd.com"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Contact support
          </a>
        </p>
      </CardFooter>
    </Card>
  );
}
