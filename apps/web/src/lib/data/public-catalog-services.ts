import type { CatalogServiceEntry, CatalogServiceKind } from '@/domain/monetization-types';
import { clampAmountCentavos, findCatalogServiceByKey, findDefaultServiceByKey, getMonetizationSettings } from '@/lib/data/monetization-settings';
import { formatPaymentAmountLabel, getPaymentSettings } from '@/lib/data/payment-settings';

export type PublicCatalogServiceRow = {
  readonly serviceKey: string;
  readonly title: string;
  readonly description: string;
  readonly durationLabel: string;
  readonly amountCentavos: number;
  readonly amountLabel: string;
  readonly kind: CatalogServiceKind;
  readonly sessionsIncluded: number | null;
  readonly sortOrder: number;
};

export type PublicCatalogFallbackCheckout = {
  readonly amountCentavos: number;
  readonly amountLabel: string;
  readonly title: string;
};

export type PublicCatalogServicesView = {
  readonly sessions: readonly PublicCatalogServiceRow[];
  readonly packages: readonly PublicCatalogServiceRow[];
  readonly hasEnabledServices: boolean;
  readonly fallbackCheckout: PublicCatalogFallbackCheckout | null;
};

/** Customer-facing copy: admin Pricing → What's included first, then seed text if unset. */
function resolveCustomerFacingDescription(entry: CatalogServiceEntry): string {
  const fromAdmin = entry.description.trim();
  if (fromAdmin.length > 0) {
    return fromAdmin;
  }
  return findDefaultServiceByKey(entry.serviceKey)?.description?.trim() ?? '';
}

function mapPublicRow(entry: CatalogServiceEntry): PublicCatalogServiceRow {
  return {
    serviceKey: entry.serviceKey,
    title: entry.title,
    description: resolveCustomerFacingDescription(entry),
    durationLabel: entry.durationLabel,
    amountCentavos: entry.amountCentavos,
    amountLabel: formatPaymentAmountLabel(entry.amountCentavos),
    kind: entry.kind,
    sessionsIncluded: entry.sessionsIncluded ?? null,
    sortOrder: entry.sortOrder,
  };
}

export async function getPublicCatalogServices(): Promise<PublicCatalogServicesView> {
  const settings = await getMonetizationSettings();
  const enabled = settings.services
    .filter((entry) => entry.enabled && (entry.deletedAt === null || entry.deletedAt === undefined))
    .sort((left, right) => left.sortOrder - right.sortOrder)
    .map(mapPublicRow);
  const sessions = enabled.filter((row) => row.kind === 'session');
  const packages = enabled.filter((row) => row.kind === 'package');
  const hasEnabledServices = sessions.length + packages.length > 0;
  if (hasEnabledServices) {
    return {
      sessions,
      packages,
      hasEnabledServices: true,
      fallbackCheckout: null,
    };
  }
  const paymentSettings = await getPaymentSettings();
  const amountCentavos = clampAmountCentavos(paymentSettings.checkoutAmountCentavos);
  return {
    sessions,
    packages,
    hasEnabledServices: false,
    fallbackCheckout: {
      amountCentavos,
      amountLabel: formatPaymentAmountLabel(amountCentavos),
      title: 'Standard consultation',
    },
  };
}

/**
 * Resolves a catalog row by serviceKey for confirmations (includes disabled SKUs, excludes deleted).
 */
export async function getCatalogServiceByKey(serviceKey: string): Promise<PublicCatalogServiceRow | null> {
  const settings = await getMonetizationSettings();
  const entry = findCatalogServiceByKey(settings, serviceKey);
  if (entry === null) {
    return null;
  }
  return mapPublicRow(entry);
}
