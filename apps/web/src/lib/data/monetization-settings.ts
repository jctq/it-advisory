import { COLLECTIONS } from '@/domain/collections';
import {
  CATALOG_SERVICE_KINDS,
  PROMO_DISCOUNT_TYPES,
  type CatalogServiceEntry,
  type CatalogServiceKind,
  type MonetizationSettingsDocument,
  type PromoCodeEntry,
  type PromoDiscountType,
} from '@/domain/monetization-types';
import { getDb } from '@/lib/mongodb';
import { normalizePromoCode, normalizeServiceKey } from '@/lib/monetization/catalog-key-utils';

export const MONETIZATION_SETTINGS_DOCUMENT_ID = 'default';

export type MonetizationSettingsValues = {
  readonly services: readonly CatalogServiceEntry[];
  readonly promoCodes: readonly PromoCodeEntry[];
};

export type MonetizationSettingsAdminView = MonetizationSettingsValues;

const DEFAULT_SERVICES: readonly CatalogServiceEntry[] = [
  {
    serviceKey: 'project-rescue',
    title: 'Project Rescue Consultation',
    description:
      'Structured review of your project situation, risks, and next steps with a senior advisor. Includes a prioritized action plan.',
    durationLabel: '60–90 minutes',
    amountCentavos: 600_000,
    enabled: true,
    sortOrder: 0,
    kind: 'session',
    sessionsIncluded: null,
  },
  {
    serviceKey: 'vendor-validation',
    title: 'Vendor Validation Session',
    description:
      'Evaluate vendor proposals, contracts, and delivery plans. Leave with clear go/no-go criteria and negotiation points.',
    durationLabel: '60 minutes',
    amountCentavos: 600_000,
    enabled: true,
    sortOrder: 1,
    kind: 'session',
    sessionsIncluded: null,
  },
  {
    serviceKey: 'automation-scoping',
    title: 'Automation Scoping Session',
    description:
      'Map workflows worth automating, tooling options, and a realistic implementation sequence with effort estimates.',
    durationLabel: '60 minutes',
    amountCentavos: 500_000,
    enabled: true,
    sortOrder: 2,
    kind: 'session',
    sessionsIncluded: null,
  },
  {
    serviceKey: 'consultation',
    title: 'General Consultation',
    description: 'Open advisory session for technology, operations, or leadership questions not covered by other SKUs.',
    durationLabel: '60 minutes',
    amountCentavos: 500_000,
    enabled: true,
    sortOrder: 3,
    kind: 'session',
    sessionsIncluded: null,
  },
  {
    serviceKey: 'package-3-sessions',
    title: '3-Session Advisory Package',
    description:
      'Three scheduled checkpoints across your initiative: kickoff alignment, mid-flight review, and close-out recommendations.',
    durationLabel: '3 checkpoints',
    amountCentavos: 1_500_000,
    enabled: true,
    sortOrder: 4,
    kind: 'package',
    sessionsIncluded: 3,
  },
] as const;

function clampAmountCentavos(value: number): number {
  if (!Number.isFinite(value)) {
    return 600_000;
  }
  const rounded = Math.round(value);
  if (rounded < 100) {
    return 100;
  }
  if (rounded > 100_000_000) {
    return 100_000_000;
  }
  return rounded;
}

function clampSortOrder(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(999, Math.round(value)));
}

function clampPercentDiscount(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round(value)));
}

function parseDeletedAt(value: Date | string | null | undefined): Date | null {
  if (value === null || value === undefined) {
    return null;
  }
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}

/** Seed catalog row for a serviceKey (customer-facing fallback only when admin description is empty). */
export function findDefaultServiceByKey(serviceKey: string): CatalogServiceEntry | undefined {
  const normalized = normalizeServiceKey(serviceKey);
  return DEFAULT_SERVICES.find((entry) => entry.serviceKey === normalized);
}

function mergeServiceEntry(raw: CatalogServiceEntry, index: number): CatalogServiceEntry {
  const kind: CatalogServiceKind = CATALOG_SERVICE_KINDS.includes(raw.kind) ? raw.kind : 'session';
  const sessionsIncluded =
    kind === 'package' && typeof raw.sessionsIncluded === 'number' && raw.sessionsIncluded > 0
      ? Math.round(raw.sessionsIncluded)
      : null;
  const rawDescription = typeof raw.description === 'string' ? raw.description.trim() : '';
  return {
    serviceKey: normalizeServiceKey(raw.serviceKey),
    title: typeof raw.title === 'string' && raw.title.trim().length > 0 ? raw.title.trim().slice(0, 200) : raw.serviceKey,
    description: rawDescription.length > 0 ? rawDescription.slice(0, 1000) : '',
    durationLabel:
      typeof raw.durationLabel === 'string' && raw.durationLabel.trim().length > 0
        ? raw.durationLabel.trim().slice(0, 80)
        : '60 minutes',
    amountCentavos: clampAmountCentavos(raw.amountCentavos),
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    sortOrder: clampSortOrder(raw.sortOrder ?? index),
    kind,
    sessionsIncluded,
    deletedAt: parseDeletedAt(raw.deletedAt),
  };
}

function mergePromoEntry(raw: PromoCodeEntry): PromoCodeEntry {
  const discountType: PromoDiscountType = PROMO_DISCOUNT_TYPES.includes(raw.discountType)
    ? raw.discountType
    : 'percent';
  const discountValue =
    discountType === 'percent'
      ? clampPercentDiscount(raw.discountValue)
      : clampAmountCentavos(raw.discountValue);
  const applicableServiceKeys =
    Array.isArray(raw.applicableServiceKeys) && raw.applicableServiceKeys.length > 0
      ? raw.applicableServiceKeys.map((key) => normalizeServiceKey(key)).filter((key) => key.length > 0)
      : null;
  const maxRedemptions =
    typeof raw.maxRedemptions === 'number' && raw.maxRedemptions > 0 ? Math.round(raw.maxRedemptions) : 0;
  const redemptionCount =
    typeof raw.redemptionCount === 'number' && raw.redemptionCount >= 0 ? Math.round(raw.redemptionCount) : 0;
  return {
    code: normalizePromoCode(raw.code),
    discountType,
    discountValue,
    applicableServiceKeys,
    maxRedemptions,
    redemptionCount,
    validFrom: raw.validFrom instanceof Date ? raw.validFrom : raw.validFrom ? new Date(raw.validFrom) : null,
    validUntil: raw.validUntil instanceof Date ? raw.validUntil : raw.validUntil ? new Date(raw.validUntil) : null,
    enabled: typeof raw.enabled === 'boolean' ? raw.enabled : true,
    deletedAt: parseDeletedAt(raw.deletedAt),
  };
}

function defaultSettings(): MonetizationSettingsValues {
  return {
    services: DEFAULT_SERVICES,
    promoCodes: [],
  };
}

function mergeDocument(doc: MonetizationSettingsDocument | null): MonetizationSettingsValues {
  if (doc === null) {
    return defaultSettings();
  }
  const services =
    Array.isArray(doc.services) && doc.services.length > 0
      ? doc.services.map((entry, index) => mergeServiceEntry(entry, index))
      : DEFAULT_SERVICES;
  const promoCodes = Array.isArray(doc.promoCodes) ? doc.promoCodes.map(mergePromoEntry) : [];
  return { services, promoCodes };
}

export async function getMonetizationSettings(): Promise<MonetizationSettingsValues> {
  if (!process.env.MONGODB_URI) {
    return defaultSettings();
  }
  const db = await getDb();
  const doc = await db
    .collection<MonetizationSettingsDocument>(COLLECTIONS.monetizationSettings)
    .findOne({ _id: MONETIZATION_SETTINGS_DOCUMENT_ID });
  return mergeDocument(doc);
}

export async function getMonetizationSettingsAdminView(): Promise<MonetizationSettingsAdminView> {
  return getMonetizationSettings();
}

export function findCatalogServiceByKey(
  settings: MonetizationSettingsValues,
  serviceKey: string,
): CatalogServiceEntry | null {
  const normalized = normalizeServiceKey(serviceKey);
  if (normalized.length === 0) {
    return null;
  }
  const match = settings.services.find(
    (entry) =>
      entry.serviceKey === normalized && (entry.deletedAt === null || entry.deletedAt === undefined),
  );
  return match ?? null;
}

export function findEnabledCatalogService(
  settings: MonetizationSettingsValues,
  serviceKey: string,
): CatalogServiceEntry | null {
  const entry = findCatalogServiceByKey(settings, serviceKey);
  if (entry === null || !entry.enabled) {
    return null;
  }
  return entry;
}

export type PromoValidationResult =
  | { readonly ok: true; readonly promo: PromoCodeEntry; readonly discountedAmountCentavos: number }
  | { readonly ok: false; readonly error: string };

export function applyPromoToBaseAmount(
  promo: PromoCodeEntry,
  baseAmountCentavos: number,
): number {
  if (promo.discountType === 'percent') {
    const discount = Math.round((baseAmountCentavos * promo.discountValue) / 100);
    return clampAmountCentavos(baseAmountCentavos - discount);
  }
  return clampAmountCentavos(baseAmountCentavos - promo.discountValue);
}

export function validatePromoCode(
  settings: MonetizationSettingsValues,
  code: string,
  serviceKey: string,
  baseAmountCentavos: number,
): PromoValidationResult {
  const normalizedCode = normalizePromoCode(code);
  if (normalizedCode.length === 0) {
    return { ok: false, error: 'Promo code is required.' };
  }
  const promo = settings.promoCodes.find((entry) => entry.code === normalizedCode);
  if (promo === undefined) {
    return { ok: false, error: 'Promo code is not valid.' };
  }
  if (promo.deletedAt !== null && promo.deletedAt !== undefined) {
    return { ok: false, error: 'Promo code is not valid.' };
  }
  if (!promo.enabled) {
    return { ok: false, error: 'Promo code is not active.' };
  }
  const now = new Date();
  if (promo.validFrom !== null && promo.validFrom !== undefined && now < promo.validFrom) {
    return { ok: false, error: 'Promo code is not yet active.' };
  }
  if (promo.validUntil !== null && promo.validUntil !== undefined && now > promo.validUntil) {
    return { ok: false, error: 'Promo code has expired.' };
  }
  if (promo.maxRedemptions > 0 && promo.redemptionCount >= promo.maxRedemptions) {
    return { ok: false, error: 'Promo code has reached its redemption limit.' };
  }
  const normalizedServiceKey = normalizeServiceKey(serviceKey);
  if (
    promo.applicableServiceKeys !== null &&
    promo.applicableServiceKeys !== undefined &&
    promo.applicableServiceKeys.length > 0 &&
    !promo.applicableServiceKeys.includes(normalizedServiceKey)
  ) {
    return { ok: false, error: 'Promo code does not apply to this service.' };
  }
  const discountedAmountCentavos = applyPromoToBaseAmount(promo, baseAmountCentavos);
  if (discountedAmountCentavos < 100) {
    return { ok: false, error: 'Promo discount is too large for this service.' };
  }
  return { ok: true, promo, discountedAmountCentavos };
}

export type UpdateMonetizationSettingsPatch = Partial<{
  services: readonly CatalogServiceEntry[];
  promoCodes: readonly PromoCodeEntry[];
}>;

export async function updateMonetizationSettings(
  patch: UpdateMonetizationSettingsPatch,
): Promise<MonetizationSettingsAdminView> {
  const current = await getMonetizationSettings();
  const nextServices =
    patch.services !== undefined
      ? patch.services.map((entry, index) => mergeServiceEntry(entry, index))
      : current.services;
  const nextPromoCodes =
    patch.promoCodes !== undefined ? patch.promoCodes.map(mergePromoEntry) : current.promoCodes;
  if (!process.env.MONGODB_URI) {
    return { services: nextServices, promoCodes: nextPromoCodes };
  }
  const db = await getDb();
  const row: MonetizationSettingsDocument = {
    _id: MONETIZATION_SETTINGS_DOCUMENT_ID,
    services: [...nextServices],
    promoCodes: [...nextPromoCodes],
    updatedAt: new Date(),
  };
  await db
    .collection<MonetizationSettingsDocument>(COLLECTIONS.monetizationSettings)
    .replaceOne({ _id: MONETIZATION_SETTINGS_DOCUMENT_ID }, row, { upsert: true });
  return getMonetizationSettingsAdminView();
}

export async function incrementPromoRedemptionCount(code: string): Promise<void> {
  const normalizedCode = normalizePromoCode(code);
  if (normalizedCode.length === 0 || !process.env.MONGODB_URI) {
    return;
  }
  const db = await getDb();
  await db.collection<MonetizationSettingsDocument>(COLLECTIONS.monetizationSettings).updateOne(
    { _id: MONETIZATION_SETTINGS_DOCUMENT_ID, 'promoCodes.code': normalizedCode },
    { $inc: { 'promoCodes.$.redemptionCount': 1 }, $set: { updatedAt: new Date() } },
  );
}

export { normalizeServiceKey, normalizePromoCode } from '@/lib/monetization/catalog-key-utils';
export { clampAmountCentavos };
