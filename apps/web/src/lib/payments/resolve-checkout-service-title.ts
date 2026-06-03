import { getCatalogServiceByKey, getPublicCatalogServices } from '@/lib/data/public-catalog-services';

function formatServiceKeyLabel(serviceKey: string): string {
  const trimmed = serviceKey.trim();
  if (trimmed.length === 0) {
    return 'Consultation';
  }
  return trimmed
    .split('-')
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

/**
 * Resolves the customer-facing service title for provider checkout line items.
 */
export async function resolveCheckoutServiceTitle(serviceKey: string): Promise<string> {
  const trimmedKey = serviceKey.trim();
  const catalogRow = trimmedKey.length > 0 ? await getCatalogServiceByKey(trimmedKey) : null;
  if (catalogRow !== null) {
    return catalogRow.title;
  }
  if (trimmedKey.length > 0) {
    return formatServiceKeyLabel(trimmedKey);
  }
  const catalog = await getPublicCatalogServices();
  return catalog.fallbackCheckout?.title ?? 'Standard consultation';
}
