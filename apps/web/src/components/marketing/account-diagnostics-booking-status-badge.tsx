'use client';

import type { ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import type { VisitorQuizSessionSummary } from '@/lib/data/quiz-session-types';
import { resolveAccountDiagnosticsBookingStatusLabel } from '@/lib/marketing/account-diagnostics-booking-status';

const AWAITING_PAYMENT_BADGE_CLASS =
  'border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100';

const STATUS_LABELS: Record<
  ReturnType<typeof resolveAccountDiagnosticsBookingStatusLabel>,
  string
> = {
  cancelled: 'Cancelled',
  pending: 'Pending',
  confirmed: 'Confirmed',
  completed: 'Completed',
  awaiting_payment: 'Awaiting payment',
};

export function AccountDiagnosticsBookingStatusBadge(props: {
  readonly row: VisitorQuizSessionSummary;
}): ReactElement {
  const status = resolveAccountDiagnosticsBookingStatusLabel(props.row);
  const label = STATUS_LABELS[status];
  if (status === 'completed' || status === 'confirmed') {
    return <Badge variant="secondary">{label}</Badge>;
  }
  if (status === 'cancelled') {
    return <Badge variant="outline">{label}</Badge>;
  }
  return (
    <Badge variant="outline" className={AWAITING_PAYMENT_BADGE_CLASS}>
      {label}
    </Badge>
  );
}
