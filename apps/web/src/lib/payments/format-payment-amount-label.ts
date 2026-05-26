/**
 * Client-safe PHP amount formatter (no server/database imports).
 */
export function formatPaymentAmountLabel(amountCentavos: number): string {
  const pesos = amountCentavos / 100;
  return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(pesos);
}
