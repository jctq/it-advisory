'use client';

import Link from 'next/link';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import type { VisitorQuizSessionSummary } from '@/lib/data/quiz-session-types';
import {
  buildSessionManageHref,
  resolveAccountDiagnosticsSessionActions,
} from '@/lib/marketing/account-diagnostics-session-actions';
import { buildMarketingQuizSessionPath } from '@/lib/marketing/quiz-session-marketing-ref';

export type AccountDiagnosticsSessionActionsBarProps = {
  readonly row: VisitorQuizSessionSummary;
  readonly deletingId: string | null;
  readonly manageBookingEnabled: boolean;
  readonly onRequestDelete: (row: VisitorQuizSessionSummary) => void;
  readonly viewLabel?: string;
};

export function AccountDiagnosticsSessionActionsBar(
  props: AccountDiagnosticsSessionActionsBarProps,
): ReactElement {
  const actions = resolveAccountDiagnosticsSessionActions(props.row);
  const viewLabel = props.viewLabel ?? 'View';
  const manageHref = buildSessionManageHref(props.row, props.manageBookingEnabled);
  const viewHref = buildMarketingQuizSessionPath(props.row.marketingSessionRef);
  return (
    <div className="flex flex-wrap justify-end gap-2">
      {actions.includes('view') ? (
        <Button type="button" variant="outline" size="sm" asChild>
          <Link href={viewHref}>{viewLabel}</Link>
        </Button>
      ) : null}
      {actions.includes('manage') ? (
        <Button type="button" variant="secondary" size="sm" asChild>
          <Link href={manageHref}>Manage</Link>
        </Button>
      ) : null}
      {actions.includes('continue') ? (
        <Button type="button" size="sm" asChild>
          <Link href={viewHref}>Continue</Link>
        </Button>
      ) : null}
      {actions.includes('delete') ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
          disabled={props.deletingId === props.row.marketingSessionRef}
          onClick={() => props.onRequestDelete(props.row)}
        >
          {props.deletingId === props.row.marketingSessionRef ? 'Deleting…' : 'Delete'}
        </Button>
      ) : null}
    </div>
  );
}
