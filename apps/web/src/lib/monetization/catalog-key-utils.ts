/**
 * Pure helpers for catalog service keys — safe to import from Client Components.
 */

export function normalizeServiceKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, '-').slice(0, 120);
}

export function normalizePromoCode(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, '').slice(0, 64);
}
