'use client';

import { ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import {
  MarketingSectionArt,
  type MarketingSectionArtVariant,
} from '@/components/marketing/marketing-section-art';
import { MarketingNewQuizCtaLabel } from '@/components/marketing/marketing-new-quiz-cta-label';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const SERVICE_ART_BY_ID: Readonly<Record<string, MarketingSectionArtVariant>> = {
  rescue: 'services-rescue',
  vendor: 'services-vendor',
  automation: 'services-automation',
};

export type MarketingServiceTabItem = {
  readonly id: string;
  readonly label: string;
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
};

export type MarketingServiceTabsProps = {
  readonly items: readonly MarketingServiceTabItem[];
  readonly isNavigating: boolean;
  readonly onStartDiagnostic: () => void;
  readonly activeId?: string;
  readonly onActiveIdChange?: (id: string) => void;
};

/**
 * Tabbed service panel (Resonance-style) with a featured detail card.
 */
export function MarketingServiceTabs(props: MarketingServiceTabsProps): ReactElement {
  const [internalActiveId, setInternalActiveId] = useState<string>(props.items[0]?.id ?? '');
  const activeId = props.activeId ?? internalActiveId;
  const executeSetActiveId = (id: string): void => {
    if (props.activeId === undefined) {
      setInternalActiveId(id);
    }
    props.onActiveIdChange?.(id);
  };
  const activeItem = props.items.find((item) => item.id === activeId) ?? props.items[0];
  if (activeItem === undefined) {
    return <div />;
  }
  const ActiveIcon = activeItem.icon;
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:items-stretch lg:gap-10">
      <div
        className="flex flex-wrap gap-2 lg:flex-col lg:gap-1"
        role="tablist"
        aria-label="Session types"
      >
        {props.items.map((item) => {
          const isActive = item.id === activeId;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-controls={`service-panel-${item.id}`}
              id={`service-tab-${item.id}`}
              className={cn(
                'group flex min-h-11 min-w-[44%] flex-1 items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition-[border-color,background-color,box-shadow,transform] duration-200 motion-safe:hover:-translate-y-px lg:min-w-0 lg:flex-none lg:rounded-2xl lg:px-5 lg:py-4',
                isActive
                  ? 'marketing-service-tab-active border-primary/40 bg-card shadow-md ring-1 ring-primary/15'
                  : 'border-border/70 bg-background/60 hover:border-primary/25 hover:bg-card/80 dark:bg-card/40',
              )}
              onClick={() => executeSetActiveId(item.id)}
            >
              <span
                className={cn(
                  'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors',
                  isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-primary',
                )}
              >
                <Icon className="size-4" aria-hidden />
              </span>
              <span className={cn('truncate', isActive ? 'text-foreground' : 'text-muted-foreground')}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id={`service-panel-${activeItem.id}`}
        aria-labelledby={`service-tab-${activeItem.id}`}
        className="marketing-card-elevated relative overflow-hidden rounded-3xl border border-border/70 p-8 md:p-10"
      >
        <div className="marketing-service-panel-glow pointer-events-none absolute inset-0" aria-hidden />
        <div className="marketing-section-art-layer" aria-hidden>
          <MarketingSectionArt
            variant={SERVICE_ART_BY_ID[activeItem.id] ?? 'services-rescue'}
            className="absolute -right-4 top-0 h-[min(100%,22rem)] w-[min(85%,20rem)] translate-y-2"
          />
        </div>
        <div className="relative flex min-w-0 flex-col gap-6">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <ActiveIcon className="size-7" aria-hidden />
          </span>
          <div className="relative z-10 min-w-0 space-y-3 pr-6 sm:pr-20 md:pr-28">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{activeItem.title}</h3>
            <p className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">{activeItem.description}</p>
          </div>
          <Button
            type="button"
            className="relative z-10 inline-flex h-11 w-fit shrink-0 items-center gap-2 active:translate-y-0"
            disabled={props.isNavigating}
            onClick={props.onStartDiagnostic}
          >
            <MarketingNewQuizCtaLabel isNavigating={props.isNavigating} label="Match me via diagnostic" />
            <ArrowRight className="size-4 shrink-0" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
