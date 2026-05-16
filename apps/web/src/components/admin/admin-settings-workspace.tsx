'use client';

import { BrainCircuit, CreditCard, Mail, Video } from 'lucide-react';
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { AdminFormStickyFooter } from '@/components/admin/admin-form-sticky-footer';
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
  AdminSettingsForm,
  type AdminSettingsFormHandle,
  type AdminSettingsFormState,
} from '@/components/admin/admin-settings-form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

type SettingsTab = 'diagnostics' | 'payments' | 'email' | 'meetings';

const EMPTY_DIAGNOSTICS_STATE: AdminSettingsFormState = {
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

const EMPTY_MEETINGS_STATE: AdminMeetingSettingsFormState = {
  isDirty: false,
  isSaving: false,
  isLoading: true,
};

export function AdminSettingsWorkspace(): ReactElement {
  const [activeTab, setActiveTab] = useState<SettingsTab>('diagnostics');
  const [diagnosticsState, setDiagnosticsState] = useState<AdminSettingsFormState>(EMPTY_DIAGNOSTICS_STATE);
  const [paymentsState, setPaymentsState] = useState<AdminPaymentSettingsFormState>(EMPTY_PAYMENTS_STATE);
  const [emailState, setEmailState] = useState<AdminEmailSettingsFormState>(EMPTY_EMAIL_STATE);
  const [meetingsState, setMeetingsState] = useState<AdminMeetingSettingsFormState>(EMPTY_MEETINGS_STATE);
  const diagnosticsFormRef = useRef<AdminSettingsFormHandle>(null);
  const paymentsFormRef = useRef<AdminPaymentSettingsFormHandle>(null);
  const emailFormRef = useRef<AdminEmailSettingsFormHandle>(null);
  const meetingsFormRef = useRef<AdminMeetingSettingsFormHandle>(null);
  const activeState =
    activeTab === 'diagnostics'
      ? diagnosticsState
      : activeTab === 'payments'
        ? paymentsState
        : activeTab === 'email'
          ? emailState
          : meetingsState;
  const executeSaveActive = useCallback((): void => {
    if (activeTab === 'diagnostics') {
      void diagnosticsFormRef.current?.save();
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
    void meetingsFormRef.current?.save();
  }, [activeTab]);
  const executeResetActive = useCallback((): void => {
    if (activeTab === 'diagnostics') {
      diagnosticsFormRef.current?.reset();
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
    meetingsFormRef.current?.reset();
  }, [activeTab]);
  const footerHint = activeState.isDirty
    ? 'You have unsaved changes on this tab. Reset discards them, or save to apply.'
    : activeTab === 'diagnostics'
      ? 'Diagnostic intake settings apply to web and native customer flows.'
      : activeTab === 'payments'
        ? 'Payment settings control checkout, gateways, and booking confirmation timing.'
        : activeTab === 'email'
          ? 'Email settings control transactional providers and BCC copies for booking confirmations.'
          : 'Meeting settings control Zoom, Google Meet, or Microsoft Teams join links for confirmed bookings.';
  const saveLabel =
    activeTab === 'diagnostics'
      ? 'Save diagnostic settings'
      : activeTab === 'payments'
        ? 'Save payment settings'
        : activeTab === 'email'
          ? 'Save email settings'
          : 'Save meeting settings';
  return (
    <section className="mx-auto flex min-h-0 flex-col">
      <div className="space-y-6 pb-6">
        <AdminPageHeader
          eyebrow="Configuration"
          title="Settings"
          description="Manage diagnostic intake, payments, transactional email, and video meetings for customer-facing web and native experiences."
        />
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            setActiveTab(value as SettingsTab);
          }}
          className="space-y-6"
        >
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1 sm:w-auto">
            <TabsTrigger value="diagnostics" className="min-h-10 gap-2 px-4 text-sm">
              <BrainCircuit className="size-4 shrink-0" aria-hidden />
              Diagnostics
            </TabsTrigger>
            <TabsTrigger value="payments" className="min-h-10 gap-2 px-4 text-sm">
              <CreditCard className="size-4 shrink-0" aria-hidden />
              Payments
            </TabsTrigger>
            <TabsTrigger value="email" className="min-h-10 gap-2 px-4 text-sm">
              <Mail className="size-4 shrink-0" aria-hidden />
              Email
            </TabsTrigger>
            <TabsTrigger value="meetings" className="min-h-10 gap-2 px-4 text-sm">
              <Video className="size-4 shrink-0" aria-hidden />
              Meetings
            </TabsTrigger>
          </TabsList>
          <TabsContent value="diagnostics" className="mt-0 space-y-6 focus-visible:outline-none my-0">
            <AdminSettingsForm formRef={diagnosticsFormRef} onStateChange={setDiagnosticsState} />
          </TabsContent>
          <TabsContent value="payments" className="mt-0 space-y-6 focus-visible:outline-none">
            <AdminPaymentSettingsForm formRef={paymentsFormRef} onStateChange={setPaymentsState} />
          </TabsContent>
          <TabsContent value="email" className="mt-0 space-y-6 focus-visible:outline-none">
            <AdminEmailSettingsForm formRef={emailFormRef} onStateChange={setEmailState} />
          </TabsContent>
          <TabsContent value="meetings" className="mt-0 space-y-6 focus-visible:outline-none">
            <AdminMeetingSettingsForm formRef={meetingsFormRef} onStateChange={setMeetingsState} />
          </TabsContent>
        </Tabs>
      </div>
      <AdminFormStickyFooter
        hint={footerHint}
        saveLabel={saveLabel}
        isSaving={activeState.isSaving}
        isDisabled={activeState.isLoading || activeState.isSaving || !activeState.isDirty}
        onSave={executeSaveActive}
        resetLabel="Reset to saved"
        onReset={executeResetActive}
        isResetDisabled={!activeState.isDirty}
      />
    </section>
  );
}
