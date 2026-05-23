'use client';

import type { ComponentProps, ReactElement } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/** Muted placeholders that match admin tab/card surfaces in light and dark mode. */
export function AdminSkeleton(props: ComponentProps<typeof Skeleton>): ReactElement {
  return (
    <Skeleton
      {...props}
      className={cn('bg-foreground/14 dark:bg-white/4', props.className)}
    />
  );
}
