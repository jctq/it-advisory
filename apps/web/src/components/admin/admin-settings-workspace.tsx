'use client';

import { BrainCircuit, CreditCard } from 'lucide-react';
import { useCallback, useRef, useState, type ReactElement } from 'react';
import { AdminFormStickyFooter } from '@/components/admin/admin-form-sticky-footer';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
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

type SettingsTab = 'diagnostics' | 'payments';

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

export function AdminSettingsWorkspace(): ReactElement {
  const [activeTab, setActiveTab] = useState<SettingsTab>('diagnostics');
  const [diagnosticsState, setDiagnosticsState] = useState<AdminSettingsFormState>(EMPTY_DIAGNOSTICS_STATE);
  const [paymentsState, setPaymentsState] = useState<AdminPaymentSettingsFormState>(EMPTY_PAYMENTS_STATE);
  const diagnosticsFormRef = useRef<AdminSettingsFormHandle>(null);
  const paymentsFormRef = useRef<AdminPaymentSettingsFormHandle>(null);
  const activeState = activeTab === 'diagnostics' ? diagnosticsState : paymentsState;
  const executeSaveActive = useCallback((): void => {
    if (activeTab === 'diagnostics') {
      void diagnosticsFormRef.current?.save();
      return;
    }
    void paymentsFormRef.current?.save();
  }, [activeTab]);
  const executeResetActive = useCallback((): void => {
    if (activeTab === 'diagnostics') {
      diagnosticsFormRef.current?.reset();
      return;
    }
    paymentsFormRef.current?.reset();
  }, [activeTab]);
  const footerHint = activeState.isDirty
    ? 'You have unsaved changes on this tab. Reset discards them, or save to apply.'
    : activeTab === 'diagnostics'
      ? 'Diagnostic intake settings apply to web and native customer flows.'
      : 'Payment settings control checkout, gateways, and booking confirmation timing.';
  const saveLabel = activeTab === 'diagnostics' ? 'Save diagnostic settings' : 'Save payment settings';
  return (
    <section className="mx-auto flex min-h-0 flex-col">
      <div className="space-y-6 pb-6">
        <AdminPageHeader
          eyebrow="Configuration"
          title="Settings"
          description="Manage diagnostic intake and payment checkout for customer-facing web and native experiences."
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
          </TabsList>
          <TabsContent value="diagnostics" className="mt-0 space-y-6 focus-visible:outline-none my-0">
            <AdminSettingsForm formRef={diagnosticsFormRef} onStateChange={setDiagnosticsState} />
          </TabsContent>
          <TabsContent value="payments" className="mt-0 space-y-6 focus-visible:outline-none">
            <AdminPaymentSettingsForm formRef={paymentsFormRef} onStateChange={setPaymentsState} />
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
