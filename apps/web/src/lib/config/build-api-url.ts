import { resolveConfiguredApiOrigin } from '@/lib/config/api-origin';

function normalizePathname(pathname: string): string {
  if (pathname.startsWith('http://') || pathname.startsWith('https://')) {
    return pathname;
  }
  return pathname.startsWith('/') ? pathname : `/${pathname}`;
}

/**
 * Builds an API URL that stays relative by default, but can target a hosted origin for wrappers.
 */
export function buildApiUrl(pathname: string): string {
  const normalizedPathname = normalizePathname(pathname);
  if (normalizedPathname.startsWith('http://') || normalizedPathname.startsWith('https://')) {
    return normalizedPathname;
  }
  const configuredApiOrigin = resolveConfiguredApiOrigin();
  if (configuredApiOrigin === null) {
    return normalizedPathname;
  }
  return new URL(normalizedPathname, configuredApiOrigin).toString();
}
