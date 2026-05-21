'use client';

import { useCallback, useEffect, useState, type ReactElement } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, RefreshCw, XCircle } from 'lucide-react';
import { fetchPaymentTransactionStatus } from '@techmd/api-client/marketing-payment-api-client';
import { Button } from '@/components/ui/button';
import { buildApiUrl } from '@/lib/config/build-api-url';
import {
  buildMarketingBookSessionPath,
  isPlausibleMarketingQuizSessionRef,
} from '@/lib/marketing/quiz-session-marketing-ref';

const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 30;

function resolveApiBaseUrl(): string {
  const configured = buildApiUrl('/api/checkout/payment-config');
  if (configured.startsWith('http://') || configured.startsWith('https://')) {
    return new URL(configured).origin;
  }
  return '';
}

type ReturnStatus = 'loading' | 'paid' | 'failed' | 'timed_out';

export function PaymentReturnClient(): ReactElement {
  const searchParams = useSearchParams();
  const router = useRouter();
  const transactionId = searchParams.get('transactionId')?.trim() ?? '';
  const sessionRef = searchParams.get('sessionRef')?.trim() ?? '';
  const isMock = searchParams.get('mock') === '1';
  const hasValidSessionRef = isPlausibleMarketingQuizSessionRef(sessionRef);
  const [status, setStatus] = useState<ReturnStatus>('loading');
  const [paymentLabel, setPaymentLabel] = useState<string>('');
  const [pollGeneration, setPollGeneration] = useState(0);
  const retryPolling = useCallback((): void => {
    setStatus('loading');
    setPollGeneration((current) => current + 1);
  }, [setStatus]);
  const displayStatus: ReturnStatus = transactionId.length === 0 ? 'failed' : status;
  const bookCheckoutHref = hasValidSessionRef
    ? buildMarketingBookSessionPath(sessionRef)
    : '/book/manage';
  const paidRedirectPath = hasValidSessionRef
    ? `${buildMarketingBookSessionPath(sessionRef)}?payment=success&transactionId=${encodeURIComponent(transactionId)}`
    : `/book/manage?payment=success&transactionId=${encodeURIComponent(transactionId)}`;
  useEffect(() => {
    if (transactionId.length === 0) {
      return;
    }
    let cancelled = false;
    let polls = 0;
    const apiBaseUrl = resolveApiBaseUrl();
    const poll = async (): Promise<void> => {
      polls += 1;
      try {
        const result = await fetchPaymentTransactionStatus({
          apiBaseUrl,
          transactionId,
          mock: isMock,
        });
        if (cancelled) {
          return;
        }
        setPaymentLabel(result.paymentMethodLabel ?? result.gatewayId);
        if (result.status === 'paid' && result.bookingId !== null) {
          setStatus('paid');
          router.replace(paidRedirectPath);
          return;
        }
        if (result.status === 'failed' || result.status === 'expired') {
          setStatus('failed');
          return;
        }
        if (polls < MAX_POLLS) {
          window.setTimeout(() => {
            void poll();
          }, POLL_INTERVAL_MS);
        } else {
          setStatus('timed_out');
        }
      } catch {
        if (!cancelled) {
          setStatus('failed');
        }
      }
    };
    void poll();
    return () => {
      cancelled = true;
    };
  }, [isMock, paidRedirectPath, pollGeneration, router, transactionId]);
  if (displayStatus === 'loading') {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <Loader2 className="mx-auto size-10 animate-spin text-primary" />
        <p className="mt-6 text-lg font-semibold text-foreground">Confirming your payment…</p>
        <p className="mt-2 text-sm text-muted-foreground">This may take a moment. Please keep this page open.</p>
      </div>
    );
  }
  if (displayStatus === 'timed_out') {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <Loader2 className="mx-auto size-10 text-muted-foreground" />
        <h1 className="mt-6 text-2xl font-semibold text-foreground">Still confirming</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your payment may still be processing. Try checking again, or return to booking if you were not charged.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button type="button" className="gap-2" onClick={retryPolling}>
            <RefreshCw className="size-4" aria-hidden />
            Check again
          </Button>
          <Button asChild variant="outline">
            <Link href={bookCheckoutHref}>Back to booking</Link>
          </Button>
        </div>
      </div>
    );
  }
  if (displayStatus === 'failed') {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <XCircle className="mx-auto size-12 text-destructive" />
        <h1 className="mt-6 text-2xl font-semibold text-foreground">Payment not completed</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Your payment was not confirmed. You can return to checkout and try again.
        </p>
        <Button asChild className="mt-8">
          <Link href={bookCheckoutHref}>Back to booking</Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-lg px-6 py-16 text-center">
      <CheckCircle2 className="mx-auto size-12 text-primary" />
      <h1 className="mt-6 text-2xl font-semibold text-foreground">Payment successful</h1>
      {paymentLabel.length > 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">Paid via {paymentLabel}</p>
      ) : null}
      <Button asChild className="mt-8">
        <Link href={bookCheckoutHref}>Continue</Link>
      </Button>
    </div>
  );
}
