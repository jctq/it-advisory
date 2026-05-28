'use client';

import type { ReactElement, ReactNode } from 'react';
import { useElementIntersection } from '@/hooks/use-element-intersection';
import { cn } from '@/lib/utils';

const diagnosticStickyActionBarPinnedClassName =
  'fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 shadow-[0_-8px_32px_-8px_rgba(15,23,42,0.14)] backdrop-blur-md supports-backdrop-filter:bg-background/92 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6';

export type DiagnosticStickyActionBarProps = {
  readonly unpinWhenElement: HTMLElement | null;
  readonly wrapperClassName?: string;
  readonly layoutClassName?: string;
  /** Placeholder height while pinned so content below does not jump. Defaults to button-only height. */
  readonly pinnedSpacerClassName?: string;
  readonly children: ReactNode;
};

export function DiagnosticStickyActionBar(props: DiagnosticStickyActionBarProps): ReactElement {
  const isUnpinSectionVisible = useElementIntersection(props.unpinWhenElement, {
    rootMargin: '0px 0px -8px 0px',
    threshold: 0,
  });
  const isPinned = props.unpinWhenElement !== null && !isUnpinSectionVisible;
  const layoutClassName =
    props.layoutClassName ?? 'flex flex-wrap items-center justify-between gap-3';
  const pinnedSpacerClassName = props.pinnedSpacerClassName ?? 'h-[4.75rem]';
  return (
    <>
      {isPinned ? (
        <div className={cn(props.wrapperClassName, pinnedSpacerClassName, 'shrink-0')} aria-hidden />
      ) : null}
      <div
        className={cn(
          props.wrapperClassName,
          !isPinned && layoutClassName,
          isPinned && diagnosticStickyActionBarPinnedClassName,
        )}
      >
        <div
          className={cn(
            isPinned && cn('mx-auto flex w-full max-w-6xl', layoutClassName),
            !isPinned && 'contents',
          )}
        >
          {props.children}
        </div>
      </div>
    </>
  );
}
