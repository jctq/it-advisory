'use client';

import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type TemplateEditorHeaderProps = {
  readonly templateName: string;
  readonly hasUnsavedChanges: boolean;
  readonly actions: ReactNode;
  readonly className?: string;
};

export function TemplateEditorHeader(props: TemplateEditorHeaderProps): ReactElement {
  return (
    <header
      className={cn(
        'flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border pb-3',
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
