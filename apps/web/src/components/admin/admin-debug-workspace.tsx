'use client';

import { Bug, CreditCard, Timer, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { AdminClientDiagnosticWorkspace } from '@/components/admin/admin-client-diagnostic-workspace';
import { AdminCronLogsTable } from '@/components/admin/admin-cron-logs-table';
import { AdminPaymentLogsTable } from '@/components/admin/admin-payment-logs-table';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type DebugTab = 'client-diagnostic' | 'cron-logs' | 'payment-logs';

type DebugTabConfig = {
  readonly value: DebugTab;
  readonly label: string;
  readonly icon: LucideIcon;
};

const DEBUG_TABS: readonly DebugTabConfig[] = [
  { value: 'client-diagnostic', label: 'Client diagnostic', icon: Bug },
  { value: 'cron-logs', label: 'Cron logs', icon: Timer },
  { value: 'payment-logs', label: 'Payment logs', icon: CreditCard },
];

type AdminDebugWorkspaceProps = {
  readonly initialTab: DebugTab;
  readonly initialDiagnostic: string;
  readonly initialReference: string;
};

function addMountedDebugTab(previous: ReadonlySet<DebugTab>, tab: DebugTab): ReadonlySet<DebugTab> {
  if (previous.has(tab)) {
    return previous;
  }
  const next = new Set(previous);
  next.add(tab);
  return next;
}

function resolveDebugTab(value: string): DebugTab {
  if (value === 'cron-logs') {
    return 'cron-logs';
  }
  if (value === 'payment-logs') {
    return 'payment-logs';
  }
  return 'client-diagnostic';
}

function buildDebugTabUrl(tab: DebugTab): string {
  const nextParams = new URLSearchParams(window.location.search);
  if (tab === 'client-diagnostic') {
    nextParams.delete('tab');
  } else {
    nextParams.set('tab', tab);
  }
  const query = nextParams.toString();
  return query.length > 0 ? `/admin/debug?${query}` : '/admin/debug';
}

export function AdminDebugWorkspace(props: AdminDebugWorkspaceProps): ReactElement {
  const [activeTab, setActiveTab] = useState<DebugTab>(props.initialTab);
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<DebugTab>>(() => new Set([props.initialTab]));
  const [prevInitialTab, setPrevInitialTab] = useState<DebugTab>(props.initialTab);
  const tabTriggerRefs = useRef<Partial<Record<DebugTab, HTMLButtonElement>>>({});
  if (props.initialTab !== prevInitialTab) {
    setPrevInitialTab(props.initialTab);
    setActiveTab(props.initialTab);
    setMountedTabs((previous) => addMountedDebugTab(previous, props.initialTab));
  }
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
      const nextTab = resolveDebugTab(tabParam ?? '');
      setActiveTab(nextTab);
      setMountedTabs((previous) => addMountedDebugTab(previous, nextTab));
    };
    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);
  const executeChangeTab = useCallback((nextTab: DebugTab): void => {
    setActiveTab(nextTab);
    setMountedTabs((previous) => addMountedDebugTab(previous, nextTab));
    window.history.replaceState(window.history.state, '', buildDebugTabUrl(nextTab));
  }, []);
  return (
    <section className="mx-auto flex min-h-0 w-full flex-col">
      <div className="space-y-6">
        <AdminPageHeader
          eyebrow="Operations"
          title="Debug"
          description="Troubleshoot client diagnostic and booking flows, inspect cron job runs, and review payment logs."
        />
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            executeChangeTab(resolveDebugTab(value));
          }}
          className="space-y-6"
        >
          <div className="relative -mx-3 sm:mx-0" data-admin-tour="page-debug-tabs">
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
            className="mt-0 space-y-6 focus-visible:outline-none data-[state=inactive]:hidden"
          >
            {mountedTabs.has('client-diagnostic') ? (
              <div data-admin-tour="page-debug-client-diagnostic">
              <AdminClientDiagnosticWorkspace
                initialDiagnostic={props.initialDiagnostic}
                initialReference={props.initialReference}
                isActive={activeTab === 'client-diagnostic'}
              />
              </div>
            ) : null}
          </TabsContent>
          <TabsContent
            value="cron-logs"
            className="mt-0 space-y-6 focus-visible:outline-none data-[state=inactive]:hidden"
          >
            {mountedTabs.has('cron-logs') ? (
              <div data-admin-tour="page-debug-cron-logs" className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Each POST to a protected /api/cron/* route is recorded when it runs: job name, trigger (scheduler vs
                  unknown), duration, and result counts or errors. Unauthorized attempts are logged too.
                </p>
                <AdminCronLogsTable isActive={activeTab === 'cron-logs'} />
              </div>
            ) : null}
          </TabsContent>
          <TabsContent
            value="payment-logs"
            className="mt-0 space-y-6 focus-visible:outline-none data-[state=inactive]:hidden"
          >
            {mountedTabs.has('payment-logs') ? (
              <div data-admin-tour="page-debug-payment-logs" className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Each POST to /api/webhooks/* is recorded as a payment log with gateway, parsed status, matched
                  transaction and booking context, HTTP response, timing, header summary, and a raw payload snippet for
                  debugging stuck or unprocessed payments.
                </p>
                <AdminPaymentLogsTable isActive={activeTab === 'payment-logs'} />
              </div>
            ) : null}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}
