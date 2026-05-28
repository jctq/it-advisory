'use client';

import { Bug, Timer, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { AdminClientDiagnosticWorkspace } from '@/components/admin/admin-client-diagnostic-workspace';
import { AdminCronLogsTable } from '@/components/admin/admin-cron-logs-table';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { CronJobRunAdminRow } from '@/lib/data/cron-job-runs';

export type DebugTab = 'client-diagnostic' | 'cron-logs';

type DebugTabConfig = {
  readonly value: DebugTab;
  readonly label: string;
  readonly icon: LucideIcon;
};

const DEBUG_TABS: readonly DebugTabConfig[] = [
  { value: 'client-diagnostic', label: 'Client diagnostic', icon: Bug },
  { value: 'cron-logs', label: 'Cron logs', icon: Timer },
];

type AdminDebugWorkspaceProps = {
  readonly initialTab: DebugTab;
  readonly initialDiagnostic: string;
  readonly initialReference: string;
  readonly cronRuns: readonly CronJobRunAdminRow[];
};

function addMountedDebugTab(previous: ReadonlySet<DebugTab>, tab: DebugTab): ReadonlySet<DebugTab> {
  if (previous.has(tab)) {
    return previous;
  }
  const next = new Set(previous);
  next.add(tab);
  return next;
}

function resolveDebugTab(value: string | undefined): DebugTab {
  if (value === 'cron-logs') {
    return 'cron-logs';
  }
  return 'client-diagnostic';
}

export function AdminDebugWorkspace(props: AdminDebugWorkspaceProps): ReactElement {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<DebugTab>(props.initialTab);
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<DebugTab>>(() => new Set([props.initialTab]));
  const tabTriggerRefs = useRef<Partial<Record<DebugTab, HTMLButtonElement>>>({});
  if (props.initialTab !== activeTab) {
    setActiveTab(props.initialTab);
    setMountedTabs((previous) => addMountedDebugTab(previous, props.initialTab));
  }
  useEffect(() => {
    const activeTrigger = tabTriggerRefs.current[activeTab];
    if (!activeTrigger) {
      return;
    }
    activeTrigger.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTab]);
  const executeChangeTab = useCallback(
    (nextTab: DebugTab): void => {
      setActiveTab(nextTab);
      setMountedTabs((previous) => addMountedDebugTab(previous, nextTab));
      const nextParams = new URLSearchParams(window.location.search);
      if (nextTab === 'client-diagnostic') {
        nextParams.delete('tab');
      } else {
        nextParams.set('tab', nextTab);
      }
      const query = nextParams.toString();
      router.replace(query.length > 0 ? `/admin/debug?${query}` : '/admin/debug', { scroll: false });
    },
    [router],
  );
  return (
    <section className="mx-auto flex min-h-0 w-full flex-col">
      <div className="space-y-6">
        <AdminPageHeader
          eyebrow="Operations"
          title="Debug"
          description="Troubleshoot client diagnostic and booking flows, and inspect protected cron job runs."
        />
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            executeChangeTab(resolveDebugTab(value));
          }}
          className="space-y-6"
        >
          <div className="relative -mx-3 sm:mx-0">
            <div
              className="overflow-x-auto overscroll-x-contain scroll-smooth pb-0.5 scrollbar-none sm:overflow-visible"
              role="presentation"
            >
              <TabsList
                aria-label="Debug sections"
                className="inline-flex h-auto w-max max-w-none flex-nowrap justify-start gap-1 rounded-xl border border-border/70 bg-muted/50 p-1.5 shadow-sm"
              >
                {DEBUG_TABS.map((tab) => {
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
          <TabsContent
            value="client-diagnostic"
            className="mt-0 space-y-6 focus-visible:outline-none data-[state=inactive]:hidden motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:data-[state=active]:duration-200"
          >
            {mountedTabs.has('client-diagnostic') ? (
              <AdminClientDiagnosticWorkspace
                initialDiagnostic={props.initialDiagnostic}
                initialReference={props.initialReference}
              />
            ) : null}
          </TabsContent>
          <TabsContent
            value="cron-logs"
            className="mt-0 space-y-6 focus-visible:outline-none data-[state=inactive]:hidden motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:data-[state=active]:duration-200"
          >
            {mountedTabs.has('cron-logs') ? (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Each POST to a protected /api/cron/* route is recorded when it runs: job name, trigger (scheduler vs
                  unknown), duration, and result counts or errors. Unauthorized attempts are logged too.
                </p>
                <AdminCronLogsTable initialData={props.cronRuns} />
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
