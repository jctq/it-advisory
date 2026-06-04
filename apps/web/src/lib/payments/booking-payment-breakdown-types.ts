export type BookingPaymentBreakdown = {
  readonly serviceTitle: string;
  readonly subtotalAmountLabel: string;
  readonly discountCentavos: number;
  readonly discountLabel: string | null;
  readonly appliedPromoCode: string | null;
  readonly recordingSurchargeLabel: string | null;
  readonly totalLabel: string;
};
