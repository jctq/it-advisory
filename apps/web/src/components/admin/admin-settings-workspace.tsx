'use client';

import { BrainCircuit, CircleDollarSign, Clapperboard, CreditCard, Headphones, Mail, Video, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import {
  AdminFormStickyFooter,
  adminFormStickyFooterScrollPaddingClass,
} from '@/components/admin/admin-form-sticky-footer';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  AdminEmailSettingsForm,
  type AdminEmailSettingsFormHandle,
  type AdminEmailSettingsFormState,
} from '@/components/admin/admin-email-settings-form';
import {
  AdminMeetingSettingsForm,
  type AdminMeetingSettingsFormHandle,
  type AdminMeetingSettingsFormState,
} from '@/components/admin/admin-meeting-settings-form';
import {
  AdminPaymentSettingsForm,
  type AdminPaymentSettingsFormHandle,
  type AdminPaymentSettingsFormState,
} from '@/components/admin/admin-payment-settings-form';
import {
  AdminPricingSettingsForm,
  type AdminPricingSettingsFormHandle,
  type AdminPricingSettingsFormState,
} from '@/components/admin/admin-pricing-settings-form';
import {
  AdminRecordingSettingsForm,
  type AdminRecordingSettingsFormHandle,
  type AdminRecordingSettingsFormState,
} from '@/components/admin/admin-recording-settings-form';
import {
  AdminSupportSettingsForm,
  type AdminSupportSettingsFormHandle,
  type AdminSupportSettingsFormState,
} from '@/components/admin/admin-support-settings-form';
import {
  AdminSettingsForm,
  type AdminSettingsFormHandle,
  type AdminSettingsFormState,
} from '@/components/admin/admin-settings-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type SettingsTab = 'general' | 'pricing' | 'payments' | 'email' | 'support' | 'meetings' | 'recordings';

type SettingsTabConfig = {
  readonly value: SettingsTab;
  readonly label: string;
  readonly icon: LucideIcon;
};

const SETTINGS_TABS: readonly SettingsTabConfig[] = [
  { value: 'general', label: 'General', icon: BrainCircuit },
  { value: 'pricing', label: 'Pricing', icon: CircleDollarSign },
  { value: 'payments', label: 'Payments', icon: CreditCard },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'support', label: 'Support', icon: Headphones },
  { value: 'meetings', label: 'Meetings', icon: Video },
  { value: 'recordings', label: 'Recordings', icon: Clapperboard },
];

const EMPTY_GENERAL_STATE: AdminSettingsFormState = {
  isDirty: false,
  isSaving: false,
  isLoading: true,
};

const EMPTY_PAYMENTS_STATE: AdminPaymentSettingsFormState = {
  isDirty: false,
  isSaving: false,
  isLoading: true,
};

const EMPTY_EMAIL_STATE: AdminEmailSettingsFormState = {
  isDirty: false,
  isSaving: false,
  isLoading: true,
};

const EMPTY_PRICING_STATE: AdminPricingSettingsFormState = {
  isDirty: false,
  isSaving: false,
  isLoading: true,
};

const EMPTY_MEETINGS_STATE: AdminMeetingSettingsFormState = {
  isDirty: false,
  isSaving: false,
  isLoading: true,
};

const EMPTY_RECORDINGS_STATE: AdminRecordingSettingsFormState = {
  isDirty: false,
  isSaving: false,
  isLoading: true,
};

const EMPTY_SUPPORT_STATE: AdminSupportSettingsFormState = {
  isDirty: false,
  isSaving: false,
  isLoading: true,
};

function addMountedSettingsTab(
  previous: ReadonlySet<SettingsTab>,
  tab: SettingsTab,
): ReadonlySet<SettingsTab> {
  if (previous.has(tab)) {
    return previous;
  }
  const next = new Set(previous);
  next.add(tab);
  return next;
}

export function AdminSettingsWorkspace(): ReactElement {
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [mountedTabs, setMountedTabs] = useState<ReadonlySet<SettingsTab>>(() => new Set(['general']));
  const [generalState, setGeneralState] = useState<AdminSettingsFormState>(EMPTY_GENERAL_STATE);
  const [pricingState, setPricingState] = useState<AdminPricingSettingsFormState>(EMPTY_PRICING_STATE);
  const [paymentsState, setPaymentsState] = useState<AdminPaymentSettingsFormState>(EMPTY_PAYMENTS_STATE);
  const [emailState, setEmailState] = useState<AdminEmailSettingsFormState>(EMPTY_EMAIL_STATE);
  const [meetingsState, setMeetingsState] = useState<AdminMeetingSettingsFormState>(EMPTY_MEETINGS_STATE);
  const [recordingsState, setRecordingsState] = useState<AdminRecordingSettingsFormState>(EMPTY_RECORDINGS_STATE);
  const [supportState, setSupportState] = useState<AdminSupportSettingsFormState>(EMPTY_SUPPORT_STATE);
  const generalFormRef = useRef<AdminSettingsFormHandle>(null);
  const pricingFormRef = useRef<AdminPricingSettingsFormHandle>(null);
  const paymentsFormRef = useRef<AdminPaymentSettingsFormHandle>(null);
  const emailFormRef = useRef<AdminEmailSettingsFormHandle>(null);
  const meetingsFormRef = useRef<AdminMeetingSettingsFormHandle>(null);
  const recordingsFormRef = useRef<AdminRecordingSettingsFormHandle>(null);
  const supportFormRef = useRef<AdminSupportSettingsFormHandle>(null);
  const tabTriggerRefs = useRef<Partial<Record<SettingsTab, HTMLButtonElement>>>({});
  useEffect(() => {
    const activeTrigger = tabTriggerRefs.current[activeTab];
    if (!activeTrigger) {
      return;
    }
    activeTrigger.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTab]);
  const activeState =
    activeTab === 'general'
      ? generalState
      : activeTab === 'pricing'
        ? pricingState
        : activeTab === 'payments'
          ? paymentsState
          : activeTab === 'email'
            ? emailState
            : activeTab === 'support'
            ? supportState
            : activeTab === 'meetings'
              ? meetingsState
              : recordingsState;
  const executeSaveActive = useCallback((): void => {
    if (activeTab === 'general') {
      void generalFormRef.current?.save();
      return;
    }
    if (activeTab === 'pricing') {
      void pricingFormRef.current?.save();
      return;
    }
    if (activeTab === 'payments') {
      void paymentsFormRef.current?.save();
      return;
    }
    if (activeTab === 'email') {
      void emailFormRef.current?.save();
      return;
    }
    if (activeTab === 'support') {
      void supportFormRef.current?.save();
      return;
    }
    if (activeTab === 'meetings') {
      void meetingsFormRef.current?.save();
      return;
    }
    void recordingsFormRef.current?.save();
  }, [activeTab]);
  const executeResetActive = useCallback((): void => {
    if (activeTab === 'general') {
      generalFormRef.current?.reset();
      return;
    }
    if (activeTab === 'pricing') {
      pricingFormRef.current?.reset();
      return;
    }
    if (activeTab === 'payments') {
      paymentsFormRef.current?.reset();
      return;
    }
    if (activeTab === 'email') {
      emailFormRef.current?.reset();
      return;
    }
    if (activeTab === 'support') {
      supportFormRef.current?.reset();
      return;
    }
    if (activeTab === 'meetings') {
      meetingsFormRef.current?.reset();
      return;
    }
    recordingsFormRef.current?.reset();
  }, [activeTab]);
  return (
    <section className="mx-auto flex min-h-0 flex-col w-full pb-16">
      <div className={cn('space-y-6', adminFormStickyFooterScrollPaddingClass)}>
        <AdminPageHeader
          eyebrow="Configuration"
          title="Settings"
          description="Manage diagnostic intake, pricing, payments, transactional email, video meetings, and consultation recordings for customer-facing web and native experiences."
        />
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            const nextTab = value as SettingsTab;
            setActiveTab(nextTab);
            setMountedTabs((previous) => addMountedSettingsTab(previous, nextTab));
          }}
          className="space-y-6"
        >
          <div className="relative -mx-3 sm:mx-0" data-admin-tour="page-settings-tabs">
            <div
              className="overflow-x-auto overscroll-x-contain scroll-smooth pb-0.5 scrollbar-none sm:overflow-visible"
              role="presentation"
            >
              <TabsList
                aria-label="Settings sections"
                className="inline-flex h-auto w-max max-w-none flex-nowrap justify-start gap-1 rounded-xl border border-border/70 bg-muted/50 p-1.5 shadow-sm"
              >
                {SETTINGS_TABS.map((tab) => {
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
          <div data-admin-tour="page-settings-content">
          <TabsContent
            value="general"
            className="mt-0 space-y-6 focus-visible:outline-none data-[state=inactive]:hidden motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:data-[state=active]:duration-200"
          >
            {mountedTabs.has('general') ? (
              <AdminSettingsForm formRef={generalFormRef} onStateChange={setGeneralState} />
            ) : null}
          </TabsContent>
          <TabsContent
            value="pricing"
            className="mt-0 space-y-6 focus-visible:outline-none data-[state=inactive]:hidden motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:data-[state=active]:duration-200"
          >
            {mountedTabs.has('pricing') ? (
              <AdminPricingSettingsForm formRef={pricingFormRef} onStateChange={setPricingState} />
            ) : null}
          </TabsContent>
          <TabsContent
            value="payments"
            className="mt-0 space-y-6 focus-visible:outline-none data-[state=inactive]:hidden motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:data-[state=active]:duration-200"
          >
            {mountedTabs.has('payments') ? (
              <AdminPaymentSettingsForm formRef={paymentsFormRef} onStateChange={setPaymentsState} />
            ) : null}
          </TabsContent>
          <TabsContent
            value="email"
            className="mt-0 space-y-6 focus-visible:outline-none data-[state=inactive]:hidden motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:data-[state=active]:duration-200"
          >
            {mountedTabs.has('email') ? (
              <AdminEmailSettingsForm formRef={emailFormRef} onStateChange={setEmailState} />
            ) : null}
          </TabsContent>
          <TabsContent
            value="support"
            className="mt-0 space-y-6 focus-visible:outline-none data-[state=inactive]:hidden motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:data-[state=active]:duration-200"
          >
            {mountedTabs.has('support') ? (
              <AdminSupportSettingsForm formRef={supportFormRef} onStateChange={setSupportState} />
            ) : null}
          </TabsContent>
          <TabsContent
            value="meetings"
            className="mt-0 space-y-6 focus-visible:outline-none data-[state=inactive]:hidden motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:data-[state=active]:duration-200"
          >
            {mountedTabs.has('meetings') ? (
              <AdminMeetingSettingsForm formRef={meetingsFormRef} onStateChange={setMeetingsState} />
            ) : null}
          </TabsContent>
          <TabsContent
            value="recordings"
            className="mt-0 space-y-6 focus-visible:outline-none data-[state=inactive]:hidden motion-safe:data-[state=active]:animate-in motion-safe:data-[state=active]:fade-in-0 motion-safe:data-[state=active]:duration-200"
          >
            {mountedTabs.has('recordings') ? (
              <AdminRecordingSettingsForm formRef={recordingsFormRef} onStateChange={setRecordingsState} />
            ) : null}
          </TabsContent>
          </div>
        </Tabs>
      </div>
      <AdminFormStickyFooter
        isSaving={activeState.isSaving}
        isDisabled={activeState.isLoading || activeState.isSaving || !activeState.isDirty}
        onSave={executeSaveActive}
        onReset={executeResetActive}
        isResetDisabled={!activeState.isDirty}
      />
    </section>
  );
}
