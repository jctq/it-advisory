/**
 * Builds PSP success/cancel URLs. Native in-app checkout uses a minimal HTML route so
 * ASWebAuthenticationSession can complete before any heavy client bundle runs.
 */
export function buildPaymentProviderReturnUrls(params: {
  readonly appBaseUrl: string;
  readonly transactionId: string;
  readonly nativeInAppPaymentReturn: boolean;
  readonly cancelRelativeUrl: '/book?payment=cancelled' | '/book/manage?payment=cancelled';
}): { readonly successUrl: string; readonly cancelUrl: string } {
  const base = params.appBaseUrl.replace(/\/$/, '');
  const successPath = params.nativeInAppPaymentReturn ? '/book/payment/native-close' : '/book/payment/return';
  return {
    successUrl: `${base}${successPath}?transactionId=${encodeURIComponent(params.transactionId)}`,
    cancelUrl: `${base}${params.cancelRelativeUrl}`,
  };
}
