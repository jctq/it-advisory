'use client';

import Link from 'next/link';
import { CalendarDays, LayoutList, LogOut, User } from 'lucide-react';
import type { ReactElement } from 'react';
import type { AuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { cn } from '@/lib/utils';

const ACCOUNT_MENU_ITEM_CLASS =
  'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-accent';

export type MarketingHeaderAccountMenuPanelProps = {
  readonly user: AuthenticatedMarketingUser;
  readonly manageBookingEnabled: boolean;
  readonly onSignOut: () => void;
  readonly onNavigate?: () => void;
  readonly className?: string;
};

/**
 * Signed-in account actions shared by desktop dropdown and mobile sheet.
 */
export function MarketingHeaderAccountMenuPanel(props: MarketingHeaderAccountMenuPanelProps): ReactElement {
  const executeNavigate = props.onNavigate ?? ((): void => undefined);
  return (
    <div className={cn('flex flex-col', props.className)} role="menu" aria-label="Account menu">
      <div className="border-b border-border/60 px-3 py-2">
        <p className="text-xs font-medium text-muted-foreground">Signed in</p>
        <p className="break-all text-sm font-medium text-foreground">{props.user.email}</p>
      </div>
      <Link
        href="/account/profile"
        role="menuitem"
        className={ACCOUNT_MENU_ITEM_CLASS}
        onClick={executeNavigate}
      >
        <User className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        Profile
      </Link>
      <Link
        href="/account/diagnostics"
        role="menuitem"
        className={ACCOUNT_MENU_ITEM_CLASS}
        onClick={executeNavigate}
      >
        <LayoutList className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        My diagnostics
      </Link>
      {props.manageBookingEnabled ? (
        <Link
          href="/book/manage"
          role="menuitem"
          className={ACCOUNT_MENU_ITEM_CLASS}
          onClick={executeNavigate}
        >
          <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          Manage booking
        </Link>
      ) : null}
      <button
        type="button"
        role="menuitem"
        className={cn(ACCOUNT_MENU_ITEM_CLASS, 'w-full text-left')}
        onClick={() => {
          executeNavigate();
          props.onSignOut();
        }}
      >
        <LogOut className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        Sign out
      </button>
    </div>
  );
}
