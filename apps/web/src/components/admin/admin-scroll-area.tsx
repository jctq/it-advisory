'use client';

import type { ReactElement } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export type AdminScrollAreaProps = React.ComponentProps<typeof ScrollArea> & {
  readonly viewportRef?: React.Ref<HTMLDivElement>;
  readonly viewportClassName?: string;
};

/**
 * Bounded admin panels (cards, dialogs, sidebars). Document/page scroll stays native.
 */
export function AdminScrollArea({
  className,
  viewportRef,
  viewportClassName,
  children,
  ...props
}: AdminScrollAreaProps): ReactElement {
  return (
    <ScrollArea
      className={cn('min-h-0', className)}
      viewportRef={viewportRef}
      viewportClassName={cn('pr-4', viewportClassName)}
      {...props}
    >
      {children}
    </ScrollArea>
  );
}
