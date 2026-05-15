import { Suspense, type ReactElement } from 'react';
import { PaymentReturnClient } from './payment-return-client';

export const metadata = {
  title: 'Payment — IT Advisory',
};

export default function PaymentReturnPage(): ReactElement {
  return (
    <Suspense fallback={<p className="mx-auto max-w-lg px-6 py-16 text-center text-sm text-muted-foreground">Loading…</p>}>
      <PaymentReturnClient />
    </Suspense>
  );
}
