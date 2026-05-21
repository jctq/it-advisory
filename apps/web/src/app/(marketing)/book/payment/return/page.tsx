import { Suspense, type ReactElement } from 'react';
import { PaymentReturnClient } from './payment-return-client';
import { buildNoIndexMetadata } from '@/lib/seo/site-seo';

export const metadata = buildNoIndexMetadata({
  title: 'Payment — TechMD',
  description: 'Payment status for your TechMD consultation booking.',
});

export default function PaymentReturnPage(): ReactElement {
  return (
    <Suspense fallback={<p className="mx-auto max-w-lg px-6 py-16 text-center text-sm text-muted-foreground">Loading…</p>}>
      <PaymentReturnClient />
    </Suspense>
  );
}
