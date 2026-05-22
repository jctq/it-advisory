export const KNOWN_CATALOG_SERVICE_KEYS = [
  'project-rescue',
  'vendor-validation',
  'automation-scoping',
  'consultation',
  'package-3-sessions',
] as const;

export type KnownCatalogServiceKey = (typeof KNOWN_CATALOG_SERVICE_KEYS)[number];

export const CATALOG_SERVICE_KINDS = ['session', 'package'] as const;

export type CatalogServiceKind = (typeof CATALOG_SERVICE_KINDS)[number];

export const PROMO_DISCOUNT_TYPES = ['percent', 'fixed_centavos'] as const;

export type PromoDiscountType = (typeof PROMO_DISCOUNT_TYPES)[number];

export type CatalogServiceEntry = {
  readonly serviceKey: string;
  readonly title: string;
  /** Admin-facing and customer-facing summary of what is included. */
  readonly description: string;
  readonly durationLabel: string;
  readonly amountCentavos: number;
  readonly enabled: boolean;
  readonly sortOrder: number;
  readonly kind: CatalogServiceKind;
  /** Package SKUs only — number of sessions included in the bundle. */
  readonly sessionsIncluded?: number | null;
  /** When set, hidden from checkout and public catalog; retained for history. */
  readonly deletedAt?: Date | string | null;
};

export type PromoCodeEntry = {
  readonly code: string;
  readonly discountType: PromoDiscountType;
  readonly discountValue: number;
  readonly applicableServiceKeys?: readonly string[] | null;
  readonly maxRedemptions: number;
  readonly redemptionCount: number;
  readonly validFrom?: Date | null;
  readonly validUntil?: Date | null;
  readonly enabled: boolean;
  /** When set, promo cannot be redeemed; retained for reporting. */
  readonly deletedAt?: Date | string | null;
};

/** Singleton document `_id: default` — service catalog and promo codes (admin). */
export type MonetizationSettingsDocument = {
  _id: string;
  services: CatalogServiceEntry[];
  promoCodes: PromoCodeEntry[];
  updatedAt: Date;
};

export type CheckoutPricingSource = 'custom_quote' | 'promo' | 'catalog' | 'fallback';
