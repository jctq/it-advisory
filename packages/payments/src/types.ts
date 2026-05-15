import type { PaymentGatewayId, PaymentStatus } from '@techmd/domain/payment-types';

export type CreateCheckoutSessionInput = {
  readonly amountCentavos: number;
  readonly currency: 'PHP';
  readonly description: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
  readonly referenceId: string;
  readonly metadata: Readonly<Record<string, string>>;
  readonly sandboxMode: boolean;
  /** Gateway-specific method id (e.g. card, gcash, maya). Restricts provider checkout when supported. */
  readonly paymentMethodId: string;
  /** Pre-fills customer details on the provider checkout when supported. */
  readonly customerName?: string;
  readonly customerEmail?: string;
  readonly customerPhone?: string;
};

export type CreateCheckoutSessionResult = {
  readonly providerRef: string;
  readonly providerSessionId: string;
  readonly redirectUrl: string;
};

export type ParsedWebhookEvent = {
  readonly providerRef: string;
  readonly providerSessionId: string;
  readonly status: PaymentStatus;
  readonly amountCentavos?: number;
  readonly raw: unknown;
};

export type ReconcileCheckoutSessionInput = {
  readonly providerSessionId: string;
  readonly providerRef: string;
  readonly sandboxMode: boolean;
};

export type PaymentGatewayAdapter = {
  readonly gatewayId: PaymentGatewayId;
  getCapabilities(): readonly string[];
  createCheckoutSession(input: CreateCheckoutSessionInput): Promise<CreateCheckoutSessionResult>;
  reconcileCheckoutSession(input: ReconcileCheckoutSessionInput): Promise<ParsedWebhookEvent | null>;
  parseWebhook(request: {
    readonly bodyText: string;
    readonly headers: Readonly<Record<string, string | undefined>>;
  }): ParsedWebhookEvent | null;
  testConnection(): Promise<{ readonly ok: boolean; readonly message: string }>;
};

export type GatewayCredentials = Readonly<Record<string, string>>;
