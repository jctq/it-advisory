import type { ObjectId } from 'mongodb';

export const PAYMENT_GATEWAY_IDS = ['xendit', 'paymongo', 'hitpay', 'paypal'] as const;

export type PaymentGatewayId = (typeof PAYMENT_GATEWAY_IDS)[number];

export const PAYMENT_POLICIES = ['pay_before_booking', 'pay_after_hold', 'manual_confirm'] as const;

export type PaymentPolicy = (typeof PAYMENT_POLICIES)[number];

/** Payment policies selectable in admin (legacy `pay_before_booking` is migrated to `pay_after_hold`). */
export const ADMIN_PAYMENT_POLICIES = ['pay_after_hold', 'manual_confirm'] as const;

export type AdminPaymentPolicy = (typeof ADMIN_PAYMENT_POLICIES)[number];

export const PAYMENT_STATUSES = ['pending', 'processing', 'paid', 'failed', 'expired', 'refunded'] as const;

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type PaymentCurrencyCode = 'PHP';

/** AES-256-GCM blob stored in Mongo — opaque to clients. */
export type EncryptedCredentialBlob = {
  readonly iv: string;
  readonly ciphertext: string;
  readonly tag: string;
};

export type PaymentGatewayCredentialsPlain = Readonly<Record<string, string>>;

export type PaymentMethodOption = {
  readonly id: string;
  readonly label: string;
  readonly hint: string;
};

export type PaymentGatewayPublicConfig = {
  readonly id: PaymentGatewayId;
  readonly label: string;
  readonly description: string;
  readonly methodLabels: readonly string[];
  readonly methods: readonly PaymentMethodOption[];
};

export const PAYMENT_GATEWAY_METHOD_CATALOG: Record<PaymentGatewayId, readonly PaymentMethodOption[]> = {
  paymongo: [
    { id: 'card', label: 'Credit / Debit Card', hint: 'Visa · Mastercard · JCB' },
    { id: 'gcash', label: 'GCash', hint: 'Pay with GCash' },
    { id: 'maya', label: 'Maya', hint: 'Pay with Maya' },
    { id: 'grabpay', label: 'GrabPay', hint: 'Pay with GrabPay' },
    { id: 'shopeepay', label: 'ShopeePay', hint: 'ShopeePay wallet' },
  ],
  xendit: [
    { id: 'card', label: 'Credit / Debit Card', hint: 'Visa · Mastercard' },
    { id: 'gcash', label: 'GCash', hint: 'Pay with GCash' },
    { id: 'maya', label: 'Maya', hint: 'Pay with Maya' },
    { id: 'grabpay', label: 'GrabPay', hint: 'Pay with GrabPay' },
  ],
  hitpay: [
    { id: 'card', label: 'Credit / Debit Card', hint: 'Visa · Mastercard' },
    { id: 'gcash', label: 'GCash', hint: 'Pay with GCash' },
    { id: 'paynow_online', label: 'PayNow', hint: 'PayNow online banking' },
  ],
  paypal: [{ id: 'paypal', label: 'PayPal', hint: 'Pay with your PayPal account' }],
};

export const PAYMENT_GATEWAY_PUBLIC_CONFIGS: readonly PaymentGatewayPublicConfig[] = [
  {
    id: 'paymongo',
    label: 'PayMongo',
    description: 'Cards, e-wallets, and BNPL via PayMongo.',
    methodLabels: ['Card', 'GCash', 'Maya', 'GrabPay', 'ShopeePay'],
    methods: PAYMENT_GATEWAY_METHOD_CATALOG.paymongo,
  },
  {
    id: 'xendit',
    label: 'Xendit',
    description: 'Philippine e-wallets and cards via Xendit.',
    methodLabels: ['Card', 'GCash', 'Maya', 'GrabPay'],
    methods: PAYMENT_GATEWAY_METHOD_CATALOG.xendit,
  },
  {
    id: 'hitpay',
    label: 'HitPay',
    description: 'Cards and local payment methods via HitPay.',
    methodLabels: ['Card', 'GCash', 'PayNow'],
    methods: PAYMENT_GATEWAY_METHOD_CATALOG.hitpay,
  },
  {
    id: 'paypal',
    label: 'PayPal',
    description: 'Pay with your PayPal account.',
    methodLabels: ['PayPal'],
    methods: PAYMENT_GATEWAY_METHOD_CATALOG.paypal,
  },
] as const;

export function findPaymentMethodOption(
  gatewayId: PaymentGatewayId,
  methodId: string,
): PaymentMethodOption | null {
  const methods = PAYMENT_GATEWAY_METHOD_CATALOG[gatewayId];
  return methods.find((method) => method.id === methodId) ?? null;
}

/** Singleton document `_id: default` — admin payment configuration. */
export type PaymentSettingsDocument = {
  _id: string;
  paymentsEnabled: boolean;
  paymentPolicy: PaymentPolicy;
  currency: PaymentCurrencyCode;
  checkoutAmountCentavos: number;
  holdExpiresMinutes: number;
  sandboxMode: boolean;
  enabledGateways: Record<PaymentGatewayId, boolean>;
  gatewayCredentials: Partial<Record<PaymentGatewayId, EncryptedCredentialBlob>>;
  updatedAt: Date;
};

export type PaymentTransactionDocument = {
  _id?: ObjectId;
  gatewayId: PaymentGatewayId;
  providerRef: string;
  providerSessionId: string;
  status: PaymentStatus;
  paymentPolicy: PaymentPolicy;
  amountCentavos: number;
  currency: PaymentCurrencyCode;
  visitorId: string;
  bookingId?: ObjectId | null;
  bookingDraftId: string;
  serviceKey: string;
  startsAt: Date;
  timezone: string;
  leadId?: ObjectId | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerCompany?: string | null;
  customerPhone?: string | null;
  quizSessionIdHex?: string | null;
  paymentMethodLabel?: string | null;
  redirectUrl?: string | null;
  metadata?: Record<string, string>;
  rawWebhookPayload?: unknown;
  createdAt: Date;
  updatedAt: Date;
  paidAt?: Date | null;
  expiresAt?: Date | null;
};
