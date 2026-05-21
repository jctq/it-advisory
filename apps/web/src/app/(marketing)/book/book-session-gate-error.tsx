import type { ReactElement } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { buildMarketingQuizSessionPath } from '@/lib/marketing/quiz-session-marketing-ref';

export type BookSessionGateReason = 'missing' | 'invalid_format' | 'not_found' | 'already_booked';

type BookSessionGateErrorProps = {
  readonly reason: BookSessionGateReason;
  /** When set, offers a link back to the diagnostic for this ref. */
  readonly sessionRef?: string | null;
  readonly manageBookingEnabled?: boolean;
};

function resolveMessage(reason: BookSessionGateReason): string {
  if (reason === 'missing') {
    return 'Booking requires a completed diagnostic session. Start or continue your diagnostic, then book from the outcome screen.';
  }
  if (reason === 'invalid_format') {
    return 'This booking link is not valid. Start a new diagnostic to get a fresh booking link.';
  }
  if (reason === 'already_booked') {
    return 'This diagnostic is already linked to a booking. You cannot start a new checkout for this session.';
  }
  return 'This diagnostic was not found or you no longer have access to it.';
}

/**
 * Shown when `/book` is opened without a valid, visitor-owned diagnostic session.
 */
export function BookSessionGateError(props: BookSessionGateErrorProps): ReactElement {
  const { reason, sessionRef, manageBookingEnabled = false } = props;
  const trimmedRef = sessionRef?.trim() ?? '';
  const hasSessionRef = trimmedRef.length > 0;
  return (
    <div className="mx-auto max-w-lg px-6 py-16 md:py-24">
      <div
        className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive"
        role="alert"
      >
        <p>{resolveMessage(reason)}</p>
        <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
          {hasSessionRef ? (
            <Link
              href={buildMarketingQuizSessionPath(trimmedRef)}
              className="font-medium underline underline-offset-2"
            >
              Open diagnostic
            </Link>
          ) : null}
          <Link href="/diagnostic" className="font-medium underline underline-offset-2">
            Start diagnostic
          </Link>
          <Link href="/account/diagnostics" className="font-medium underline underline-offset-2">
            My diagnostics
          </Link>
          {reason === 'already_booked' && manageBookingEnabled ? (
            <Link href="/book/manage" className="font-medium underline underline-offset-2">
              Manage booking
            </Link>
          ) : null}
        </p>
      </div>
      <Button asChild className="mt-8" variant="outline">
        <Link href="/">Back to home</Link>
      </Button>
    </div>
  );
}
