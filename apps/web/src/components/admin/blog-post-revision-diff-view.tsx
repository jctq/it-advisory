'use client';

import type { ReactElement } from 'react';
import type { BlogPostRevisionDetail, TextDiffLine } from '@/lib/blog-post-revision-types';
import { cn } from '@/lib/utils';

type BlogPostRevisionDiffViewProps = {
  readonly revision: BlogPostRevisionDetail;
};

function DiffLineRow(props: { readonly line: TextDiffLine }): ReactElement {
  const gutterClass =
    props.line.type === 'added'
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
      : props.line.type === 'removed'
        ? 'bg-red-500/10 text-red-700 dark:text-red-300'
        : 'bg-muted/30 text-muted-foreground';
  const contentClass =
    props.line.type === 'added'
      ? 'bg-emerald-500/8 text-foreground'
      : props.line.type === 'removed'
        ? 'bg-red-500/8 text-foreground'
        : 'bg-background text-foreground';
  const prefix =
    props.line.type === 'added' ? '+' : props.line.type === 'removed' ? '-' : ' ';
  return (
    <div className="grid grid-cols-[3.5rem_1.25rem_minmax(0,1fr)] font-mono text-xs leading-5">
      <div className={cn('select-none border-r border-border/60 px-2 py-0.5 text-right tabular-nums', gutterClass)}>
        {props.line.oldLineNumber ?? ''}
      </div>
      <div className={cn('select-none border-r border-border/60 px-1 py-0.5 text-center tabular-nums', gutterClass)}>
        {props.line.newLineNumber ?? ''}
      </div>
      <div className={cn('flex min-w-0 gap-2 px-3 py-0.5', contentClass)}>
        <span className="shrink-0 text-muted-foreground">{prefix}</span>
        <pre className="min-w-0 flex-1 whitespace-pre-wrap break-words font-mono text-inherit">{props.line.content || ' '}</pre>
      </div>
    </div>
  );
}

export function BlogPostRevisionDiffView(props: BlogPostRevisionDiffViewProps): ReactElement {
  return (
    <div className="space-y-6">
      {props.revision.fieldDiffs.map((fieldDiff) => (
        <section key={fieldDiff.field} className="overflow-hidden rounded-lg border border-border">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-muted/40 px-4 py-2.5">
            <h3 className="text-sm font-semibold text-foreground">{fieldDiff.label}</h3>
            <span className="text-xs text-muted-foreground">Field changed</span>
          </header>
          <div className="overflow-x-auto">
            <div className="min-w-[32rem] border-b border-border/60 bg-muted/20">
              <div className="grid grid-cols-[3.5rem_1.25rem_minmax(0,1fr)] font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                <div className="border-r border-border/60 px-2 py-1.5 text-right">Old</div>
                <div className="border-r border-border/60 px-1 py-1.5 text-center">New</div>
                <div className="px-3 py-1.5">Line</div>
              </div>
            </div>
            {fieldDiff.lines.map((line, index) => (
              <DiffLineRow key={`${fieldDiff.field}-${index}`} line={line} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
