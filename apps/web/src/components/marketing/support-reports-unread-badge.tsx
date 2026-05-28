'use client';

import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';
import { formatSupportReportsUnreadBadgeCount } from '@/hooks/marketing/use-marketing-support-reports-unread-count';

type SupportReportsUnreadBadgeProps = {
  readonly unreadCount: number;
  readonly className?: string;
};

/**
 * Compact count badge for unread support report replies.
 */
export function SupportReportsUnreadBadge(props: SupportReportsUnreadBadgeProps): ReactElement | null {
  if (props.unreadCount <= 0) {
    return null;
  }
  const label = formatSupportReportsUnreadBadgeCount(props.unreadCount);
  return (
    <span
      className={cn(
        'inline-flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-none text-primary-foreground',
        props.className,
      )}
      aria-label={`${props.unreadCount} unread support ${props.unreadCount === 1 ? 'reply' : 'replies'}`}
    >
      {label}
    </span>
  );
}
