'use client';

import type { ReactElement } from 'react';
import { AdminSkeleton } from '@/components/admin/admin-skeleton';
import { cn } from '@/lib/utils';

export type AdminFormLoadingVariant = 'cards' | 'pricing' | 'providers';

type AdminFormLoadingPanelProps = {
  readonly label: string;
  readonly variant?: AdminFormLoadingVariant;
  readonly className?: string;
};

function SettingsCardSkeleton(props: { readonly fieldCount?: number }): ReactElement {
  const fieldCount = props.fieldCount ?? 2;
  return (
    <section className="space-y-5 rounded-2xl border border-border bg-card p-6 shadow-xs">
      <div className="flex gap-3">
        <AdminSkeleton className="size-10 shrink-0 rounded-xl" />
        <div className="min-w-0 flex-1 space-y-2">
          <AdminSkeleton className="h-5 w-40 max-w-full" />
          <AdminSkeleton className="h-4 w-full max-w-md" />
          <AdminSkeleton className="h-4 w-4/5 max-w-sm" />
        </div>
      </div>
      <div className="space-y-4">
        {Array.from({ length: fieldCount }, (_, index) => (
          <div key={index} className="space-y-2">
            <AdminSkeleton className="h-4 w-28" />
            <AdminSkeleton className="h-11 w-full max-w-md" />
          </div>
        ))}
      </div>
    </section>
  );
}

function CardsLoadingSkeleton(): ReactElement {
  return (
    <div className="space-y-6">
      <AdminSkeleton className="h-14 w-full rounded-lg" />
      <SettingsCardSkeleton fieldCount={2} />
      <SettingsCardSkeleton fieldCount={3} />
      <SettingsCardSkeleton fieldCount={2} />
    </div>
  );
}

function PricingLoadingSkeleton(): ReactElement {
  return (
    <div className="space-y-6">
      <AdminSkeleton className="h-14 w-full rounded-lg" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1 rounded-xl border border-border/70 bg-muted/50 p-1.5">
          <AdminSkeleton className="h-10 w-28 rounded-md" />
          <AdminSkeleton className="h-10 w-24 rounded-md" />
          <AdminSkeleton className="h-10 w-28 rounded-md" />
        </div>
        <AdminSkeleton className="h-5 w-28" />
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <AdminSkeleton className="h-4 w-full max-w-lg" />
        <AdminSkeleton className="h-10 w-32 rounded-md" />
      </div>
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="flex gap-4 border-b border-border bg-muted/30 px-4 py-3">
          <AdminSkeleton className="h-4 w-20" />
          <AdminSkeleton className="h-4 w-16" />
          <AdminSkeleton className="hidden h-4 w-24 sm:block" />
          <AdminSkeleton className="hidden h-4 w-14 sm:block" />
          <AdminSkeleton className="ml-auto hidden h-4 w-16 md:block" />
        </div>
        {Array.from({ length: 5 }, (_, index) => (
          <div key={index} className="flex items-center gap-4 border-b border-border/80 px-4 py-4 last:border-b-0">
            <AdminSkeleton className="h-4 w-24" />
            <AdminSkeleton className="h-4 w-32 flex-1" />
            <AdminSkeleton className="hidden h-4 w-40 sm:block" />
            <AdminSkeleton className="h-6 w-16 rounded-full" />
            <AdminSkeleton className="ml-auto h-8 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

function ProvidersLoadingSkeleton(): ReactElement {
  return (
    <div className="space-y-6">
      <AdminSkeleton className="h-16 w-full rounded-lg" />
      <SettingsCardSkeleton fieldCount={2} />
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 gap-3">
            <AdminSkeleton className="size-10 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1 space-y-2">
              <AdminSkeleton className="h-5 w-36" />
              <AdminSkeleton className="h-4 w-full max-w-sm" />
            </div>
          </div>
          <div className="flex gap-2">
            <AdminSkeleton className="h-9 w-28 rounded-md" />
            <AdminSkeleton className="h-9 w-36 rounded-md" />
          </div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
            <AdminSkeleton className="h-4 w-24" />
            <AdminSkeleton className="h-11 w-full" />
          </div>
          <div className="space-y-2 sm:col-span-2 lg:col-span-1">
            <AdminSkeleton className="h-4 w-28" />
            <AdminSkeleton className="h-11 w-full" />
          </div>
        </div>
      </section>
      <section className="space-y-4 rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="flex gap-3">
          <AdminSkeleton className="size-10 shrink-0 rounded-xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <AdminSkeleton className="h-5 w-44" />
            <AdminSkeleton className="h-4 w-full max-w-md" />
          </div>
        </div>
        <AdminSkeleton className="h-24 w-full rounded-lg" />
      </section>
    </div>
  );
}

function resolveLoadingSkeleton(variant: AdminFormLoadingVariant): ReactElement {
  if (variant === 'pricing') {
    return <PricingLoadingSkeleton />;
  }
  if (variant === 'providers') {
    return <ProvidersLoadingSkeleton />;
  }
  return <CardsLoadingSkeleton />;
}

/** Reserves vertical space with layout-matched skeletons while admin forms load. */
export function AdminFormLoadingPanel(props: AdminFormLoadingPanelProps): ReactElement {
  const variant = props.variant ?? 'cards';
  return (
    <div
      className={cn('min-h-112', props.className)}
      aria-busy="true"
      aria-live="polite"
      aria-label={props.label}
    >
      <span className="sr-only">{props.label}</span>
      {resolveLoadingSkeleton(variant)}
    </div>
  );
}
