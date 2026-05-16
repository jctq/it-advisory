'use client';

import Link from 'next/link';
import { CalendarDays, ChevronDown, LogOut, LayoutList, User } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import type { AuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { cn } from '@/lib/utils';

type MarketingHeaderAccountMenuProps = {
  readonly user: AuthenticatedMarketingUser;
  readonly onSignOut: () => void;
  readonly className?: string;
};

function resolveEmailInitial(email: string): string {
  const trimmed = email.trim();
  if (trimmed.length === 0) {
    return '?';
  }
  return trimmed[0]?.toUpperCase() ?? '?';
}

function resolveEmailLocalPart(email: string): string {
  const trimmed = email.trim();
  const atIndex = trimmed.indexOf('@');
  if (atIndex <= 0) {
    return trimmed;
  }
  return trimmed.slice(0, atIndex);
}

/**
 * Collapses signed-in account actions into one menu to reduce header crowding.
 */
export function MarketingHeaderAccountMenu(props: MarketingHeaderAccountMenuProps): ReactElement {
  const [open, setOpen] = useState<boolean>(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) {
      return;
    }
    const executeHandleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', executeHandleEscape);
    return () => {
      document.removeEventListener('keydown', executeHandleEscape);
    };
  }, [open]);
  useEffect(() => {
    if (!open) {
      return;
    }
    const executeHandlePointerDown = (event: PointerEvent): void => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', executeHandlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', executeHandlePointerDown);
    };
  }, [open]);
  const initial = resolveEmailInitial(props.user.email);
  const emailLocalPart = resolveEmailLocalPart(props.user.email);
  return (
    <div ref={rootRef} className={cn('relative', props.className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-10 gap-2 px-2 text-foreground hover:bg-muted/80"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="marketing-header-account-panel"
        aria-label={`Account menu for ${props.user.email}`}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
          {initial}
        </span>
        <span className="hidden max-w-[7.5rem] truncate text-sm font-medium sm:inline lg:max-w-[10rem] xl:max-w-[14rem]">
          {emailLocalPart}
        </span>
        <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      </Button>
      {open ? (
        <div
          id="marketing-header-account-panel"
          role="menu"
          aria-label="Account menu"
          className="absolute right-0 z-50 mt-2 w-[min(calc(100vw-2rem),16rem)] rounded-xl border border-border bg-popover py-1 shadow-lg"
        >
          <div className="border-b border-border/60 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Signed in</p>
            <p className="break-all text-sm font-medium text-foreground">{props.user.email}</p>
          </div>
          <Link
            href="/account/profile"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-popover-foreground hover:bg-accent"
            onClick={() => setOpen(false)}
          >
            <User className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            Profile
          </Link>
          <Link
            href="/account/diagnostics"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-popover-foreground hover:bg-accent"
            onClick={() => setOpen(false)}
          >
            <LayoutList className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            My diagnostics
          </Link>
          <Link
            href="/book/manage"
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2.5 text-sm text-popover-foreground hover:bg-accent"
            onClick={() => setOpen(false)}
          >
            <CalendarDays className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            Manage booking
          </Link>
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-popover-foreground hover:bg-accent"
            onClick={() => {
              setOpen(false);
              props.onSignOut();
            }}
          >
            <LogOut className="size-4 shrink-0 text-muted-foreground" aria-hidden />
            Sign out
          </button>
        </div>
      ) : null}
    </div>
  );
}
