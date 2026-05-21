'use client';

import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type TemplateEditorHeaderProps = {
  readonly templateName: string;
  readonly hasUnsavedChanges: boolean;
  readonly actions: ReactNode;
  readonly className?: string;
  /** Pin while scrolling (classic editor). Off in workspace — header stays in the flex column. */
  readonly isSticky?: boolean;
  /** When true, sticks to the viewport top (workspace fullscreen). */
  readonly isFullscreen?: boolean;
};

export function TemplateEditorHeader(props: TemplateEditorHeaderProps): ReactElement {
  const isSticky = props.isSticky === true;
  const isFullscreen = props.isFullscreen === true;
  return (
    <header
      className={cn(
        'flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border py-3',
        isSticky
          ? 'sticky z-19 isolate bg-background shadow-sm'
          : 'bg-background',
        isSticky && !isFullscreen && 'top-(--admin-sticky-top,4rem)',
        isSticky && isFullscreen && 'top-0',
        props.className,
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Customer diagnostic</p>
        <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">Edit diagnostic template</h1>
        <p className="truncate text-sm text-muted-foreground">
          {props.templateName}
          <span className="mx-1.5 text-border">·</span>
          {props.hasUnsavedChanges ? (
            <span className="text-amber-600 dark:text-amber-400">Unsaved changes</span>
          ) : (
            <span>All changes saved</span>
          )}
        </p>
      </div>
      {props.actions}
    </header>
  );
}
