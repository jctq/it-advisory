'use client';

import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type AdminDetailTabConfig<TTab extends string> = {
  readonly value: TTab;
  readonly label: string;
  readonly icon: LucideIcon;
};

type AdminDetailTabsShellProps<TTab extends string> = {
  readonly tabs: readonly AdminDetailTabConfig<TTab>[];
  readonly initialTab: TTab;
  readonly defaultTab: TTab;
  readonly resolveTab: (value: string) => TTab;
  readonly ariaLabel: string;
  readonly basePath: string;
  readonly shouldOmitTabFromUrl: (tab: TTab) => boolean;
  readonly renderPanel: (tab: TTab) => ReactNode;
};

function addMountedTab<TTab extends string>(
  previous: ReadonlySet<TTab>,
  tab: TTab,
): ReadonlySet<TTab> {
  if (previous.has(tab)) {
    return previous;
  }
  const next = new Set(previous);
  next.add(tab);
  return next;
}

function buildTabUrl<TTab extends string>(
  basePath: string,
  shouldOmitTabFromUrl: (tab: TTab) => boolean,
  tab: TTab,
): string {
  const nextParams = new URLSearchParams(window.location.search);
  if (shouldOmitTabFromUrl(tab)) {
    nextParams.delete('tab');
  } else {
    nextParams.set('tab', tab);
  }
  const query = nextParams.toString();
  return query.length > 0 ? `${basePath}?${query}` : basePath;
}

export function AdminDetailTabsShell<TTab extends string>(
  props: AdminDetailTabsShellProps<TTab>,
): ReactElement {
  const { tabs, initialTab, resolveTab, ariaLabel, basePath, shouldOmitTabFromUrl, renderPanel } = props;
  const [activeTab, setActiveTab] = useState<TTab>(initialTab);
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<TTab>>(() => new Set([initialTab]));
  const tabTriggerRefs = useRef<Partial<Record<TTab, HTMLButtonElement>>>({});
  useEffect(() => {
    setActiveTab(initialTab);
    setMountedTabs((previous) => addMountedTab(previous, initialTab));
  }, [initialTab]);
  useEffect(() => {
    const activeTrigger = tabTriggerRefs.current[activeTab];
    if (!activeTrigger) {
      return;
    }
    activeTrigger.scrollIntoView({ block: 'nearest', inline: 'center' });
  }, [activeTab]);
  useEffect(() => {
    const handlePopState = (): void => {
      const tabParam = new URLSearchParams(window.location.search).get('tab');
      const nextTab = resolveTab(tabParam ?? '');
      setActiveTab(nextTab);
      setMountedTabs((previous) => addMountedTab(previous, nextTab));
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, [resolveTab]);
  const executeChangeTab = useCallback(
    (nextTab: TTab): void => {
      setActiveTab(nextTab);
      setMountedTabs((previous) => addMountedTab(previous, nextTab));
      const nextUrl = buildTabUrl(basePath, shouldOmitTabFromUrl, nextTab);
      window.history.replaceState(window.history.state, '', nextUrl);
    },
    [basePath, shouldOmitTabFromUrl],
  );
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        executeChangeTab(resolveTab(value));
      }}
      className="space-y-6"
    >
      <div className="relative -mx-3 sm:mx-0">
        <div
          className="overflow-x-auto overscroll-x-contain scroll-smooth pb-0.5 scrollbar-none sm:overflow-visible"
          role="presentation"
        >
          <TabsList
            aria-label={ariaLabel}
            className="inline-flex h-auto w-max max-w-none flex-nowrap justify-start gap-1 rounded-xl border border-border/70 bg-muted/50 p-1.5 shadow-sm"
          >
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <TabsTrigger
                  key={tab.value}
                  value={tab.value}
                  ref={(node) => {
                    if (node) {
                      tabTriggerRefs.current[tab.value] = node;
                      return;
                    }
                    delete tabTriggerRefs.current[tab.value];
                  }}
                  className="min-h-11 shrink-0 touch-manipulation gap-2 px-3.5 text-sm sm:px-4"
                >
                  <TabIcon className="size-4 shrink-0 opacity-80" aria-hidden />
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 left-0 w-5 bg-linear-to-r from-background to-transparent sm:hidden"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-5 bg-linear-to-l from-background to-transparent sm:hidden"
        />
      </div>
      {tabs.map((tab) => (
        <TabsContent
          key={tab.value}
          value={tab.value}
          className="mt-0 space-y-6 focus-visible:outline-none data-[state=inactive]:hidden"
        >
          {mountedTabs.has(tab.value) ? renderPanel(tab.value) : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}
