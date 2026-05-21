/**
 * Builds PSP success/cancel URLs. Native in-app checkout uses a minimal HTML route so
 * ASWebAuthenticationSession can complete before any heavy client bundle runs.
 */
export function buildPaymentProviderReturnUrls(params: {
  readonly appBaseUrl: string;
  readonly transactionId: string;
  readonly nativeInAppPaymentReturn: boolean;
  /** Path + query, e.g. `/book/[sessionRef]?payment=cancelled` or `/book/manage?payment=cancelled`. */
  readonly cancelRelativeUrl: string;
  /** Marketing quiz session ref; appended to the PSP success return URL when set. */
  readonly sessionMarketingRef?: string;
}): { readonly successUrl: string; readonly cancelUrl: string } {
  const base = params.appBaseUrl.replace(/\/$/, '');
  const successPath = params.nativeInAppPaymentReturn ? '/book/payment/native-close' : '/book/payment/return';
  const sessionMarketingRef = params.sessionMarketingRef?.trim() ?? '';
  const sessionQuery =
    sessionMarketingRef.length > 0 ? `&sessionRef=${encodeURIComponent(sessionMarketingRef)}` : '';
  return {
    successUrl: `${base}${successPath}?transactionId=${encodeURIComponent(params.transactionId)}${sessionQuery}`,
    cancelUrl: `${base}${params.cancelRelativeUrl}`,
  };
}
