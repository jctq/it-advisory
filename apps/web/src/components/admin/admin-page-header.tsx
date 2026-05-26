import type { ReactNode } from 'react';

type AdminPageHeaderProps = {
  readonly eyebrow: string;
  readonly title: string;
  readonly description?: string;
  readonly actions?: ReactNode;
  readonly tourTarget?: string;
};

export function AdminPageHeader(props: AdminPageHeaderProps) {
  return (
    <header
      {...(props.tourTarget !== undefined ? { 'data-admin-tour': props.tourTarget } : {})}
      className="flex flex-wrap items-end justify-between gap-4"
    >
      <div className="space-y-2">
        <p className="text-sm text-muted-foreground">{props.eyebrow}</p>
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{props.title}</h1>
          {props.description !== undefined ? (
            <p className="mt-2 max-w-3xl text-sm text-muted-foreground">{props.description}</p>
          ) : null}
        </div>
      </div>
      {props.actions !== undefined ? <div className="flex flex-wrap items-center gap-3">{props.actions}</div> : null}
    </header>
  );
}
