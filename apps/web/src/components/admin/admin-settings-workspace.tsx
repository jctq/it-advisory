'use client';

import { BrainCircuit, CreditCard, Mail } from 'lucide-react';
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { AdminFormStickyFooter } from '@/components/admin/admin-form-sticky-footer';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import {
  AdminEmailSettingsForm,
  type AdminEmailSettingsFormHandle,
  type AdminEmailSettingsFormState,
} from '@/components/admin/admin-email-settings-form';
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

type SettingsTab = 'diagnostics' | 'payments' | 'email';

const EMPTY_DIAGNOSTICS_STATE: AdminSettingsFormState = {
  isDirty: false,
  isSaving: false,
  isLoading: true,
  statusMessage: null,
  errorMessage: null,
};

const EMPTY_PAYMENTS_STATE: AdminPaymentSettingsFormState = {
  isDirty: false,
  isSaving: false,
  isLoading: true,
  statusMessage: null,
  errorMessage: null,
};

const EMPTY_EMAIL_STATE: AdminEmailSettingsFormState = {
  isDirty: false,
  isSaving: false,
  isLoading: true,
  statusMessage: null,
  errorMessage: null,
};

export function AdminSettingsWorkspace(): ReactElement {
  const [activeTab, setActiveTab] = useState<SettingsTab>('diagnostics');
  const [diagnosticsState, setDiagnosticsState] = useState<AdminSettingsFormState>(EMPTY_DIAGNOSTICS_STATE);
  const [paymentsState, setPaymentsState] = useState<AdminPaymentSettingsFormState>(EMPTY_PAYMENTS_STATE);
  const [emailState, setEmailState] = useState<AdminEmailSettingsFormState>(EMPTY_EMAIL_STATE);
  const diagnosticsFormRef = useRef<AdminSettingsFormHandle>(null);
  const paymentsFormRef = useRef<AdminPaymentSettingsFormHandle>(null);
  const emailFormRef = useRef<AdminEmailSettingsFormHandle>(null);
  const activeState =
    activeTab === 'diagnostics' ? diagnosticsState : activeTab === 'payments' ? paymentsState : emailState;
  const executeSaveActive = useCallback((): void => {
    if (activeTab === 'diagnostics') {
      void diagnosticsFormRef.current?.save();
      return;
    }
    if (activeTab === 'payments') {
      void paymentsFormRef.current?.save();
      return;
    }
    void emailFormRef.current?.save();
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
    emailFormRef.current?.reset();
  }, [activeTab]);
  const footerHint = activeState.isDirty
    ? 'You have unsaved changes on this tab. Reset discards them, or save to apply.'
    : activeTab === 'diagnostics'
      ? 'Diagnostic intake settings apply to web and native customer flows.'
      : activeTab === 'payments'
        ? 'Payment settings control checkout, gateways, and booking confirmation timing.'
        : 'Email settings control transactional providers and BCC copies for booking confirmations.';
  const saveLabel =
    activeTab === 'diagnostics'
      ? 'Save diagnostic settings'
      : activeTab === 'payments'
        ? 'Save payment settings'
        : 'Save email settings';
  return (
    <section className="mx-auto flex min-h-0 flex-col">
      <div className="space-y-6 pb-6">
        <AdminPageHeader
          eyebrow="Configuration"
          title="Settings"
          description="Manage diagnostic intake, payments, and transactional email for customer-facing web and native experiences."
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
        </Tabs>
      </div>
      <AdminFormStickyFooter
        hint={footerHint}
        saveLabel={saveLabel}
        isSaving={activeState.isSaving}
        isDisabled={activeState.isLoading || activeState.isSaving || !activeState.isDirty}
        statusMessage={activeState.statusMessage}
        onSave={executeSaveActive}
        resetLabel="Reset to saved"
        onReset={executeResetActive}
        isResetDisabled={!activeState.isDirty}
      />
    </section>
  );
}
