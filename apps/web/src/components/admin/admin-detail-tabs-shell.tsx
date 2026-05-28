'use client';

import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
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

export function AdminDetailTabsShell<TTab extends string>(
  props: AdminDetailTabsShellProps<TTab>,
): ReactElement {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TTab>(props.initialTab);
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<TTab>>(() => new Set([props.initialTab]));
  const tabTriggerRefs = useRef<Partial<Record<TTab, HTMLButtonElement>>>({});
  useEffect(() => {
    setActiveTab(props.initialTab);
    setMountedTabs((previous) => addMountedTab(previous, props.initialTab));
  }, [props.initialTab]);
  useEffect(() => {
    const activeTrigger = tabTriggerRefs.current[activeTab];
    if (!activeTrigger) {
      return;
    }
    activeTrigger.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTab]);
  const executeChangeTab = useCallback(
    (nextTab: TTab): void => {
      setActiveTab(nextTab);
      setMountedTabs((previous) => addMountedTab(previous, nextTab));
      const nextParams = new URLSearchParams(window.location.search);
      if (props.shouldOmitTabFromUrl(nextTab)) {
        nextParams.delete('tab');
      } else {
        nextParams.set('tab', nextTab);
      }
      const query = nextParams.toString();
      router.replace(query.length > 0 ? `${props.basePath}?${query}` : props.basePath, { scroll: false });
    },
    [props.basePath, props.shouldOmitTabFromUrl, router],
  );
  return (
    <Tabs
      value={activeTab}
      onValueChange={(value) => {
        executeChangeTab(props.resolveTab(value));
      }}
      className="space-y-6"
    >
      <div className="relative -mx-3 sm:mx-0">
        <div
          className="overflow-x-auto overscroll-x-contain scroll-smooth pb-0.5 scrollbar-none sm:overflow-visible"
          role="presentation"
        >
          <TabsList
            aria-label={props.ariaLabel}
            className="inline-flex h-auto w-max max-w-none flex-nowrap justify-start gap-1 rounded-xl border border-border/70 bg-muted/50 p-1.5 shadow-sm"
          >
            {props.tabs.map((tab) => {
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
      {props.tabs.map((tab) => (
        <TabsContent
          key={tab.value}
          value={tab.value}
          className="mt-0 space-y-6 focus-visible:outline-none data-[state=inactive]:hidden motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:data-[state=active]:duration-200"
        >
          {mountedTabs.has(tab.value) ? props.renderPanel(tab.value) : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}
