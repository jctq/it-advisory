import { BRAND_LOGO_FULL_DARK, brandAssetUrl } from '@/lib/brand/brand-assets';

export const TRANSACTIONAL_EMAIL_LOGO_WIDTH_PX = 152 as const;
export const TRANSACTIONAL_EMAIL_HEADER_BG = '#0f172a' as const;

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function resolveMarketingSiteBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (raw === undefined || raw.length === 0) {
    return '';
  }
  return raw.replace(/\/$/, '');
}

/**
 * Prefer public app URL; fall back to Vercel deployment host so transactional links work when only `VERCEL_URL` is set.
 */
export function resolveAbsoluteSiteOrigin(): string {
  const fromPublic = resolveMarketingSiteBaseUrl();
  if (fromPublic.length > 0) {
    return fromPublic;
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel === undefined || vercel.length === 0) {
    return '';
  }
  if (vercel.startsWith('http://') || vercel.startsWith('https://')) {
    return vercel.replace(/\/$/, '');
  }
  return `https://${vercel.replace(/\/$/, '')}`;
}

export function resolveTransactionalEmailLogoUrl(siteOrigin: string): string | null {
  const origin = siteOrigin.trim().replace(/\/$/, '');
  if (origin.length === 0) {
    return null;
  }
  return `${origin}${brandAssetUrl(BRAND_LOGO_FULL_DARK)}`;
}

/** Dark header row with the site dark-mode wordmark (for light email clients). */
export function buildTransactionalEmailLogoHeaderRow(input: {
  readonly siteOrigin: string;
  readonly brandName: string;
}): string {
  const logoUrl = resolveTransactionalEmailLogoUrl(input.siteOrigin);
  if (logoUrl === null) {
    return '';
  }
  return `<tr><td align="left" style="padding:24px 28px;background-color:${TRANSACTIONAL_EMAIL_HEADER_BG};"><img src="${escapeHtml(logoUrl)}" width="${TRANSACTIONAL_EMAIL_LOGO_WIDTH_PX}" alt="${escapeHtml(input.brandName)}" style="display:block;width:${TRANSACTIONAL_EMAIL_LOGO_WIDTH_PX}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;" /></td></tr>`;
}

export function buildTransactionalEmailBrandNameRow(input: {
  readonly brandName: string;
  readonly fontStack: string;
}): string {
  return `<tr><td style="padding:0 0 16px 0;font-family:${input.fontStack};font-size:22px;font-weight:700;line-height:28px;color:#0f172a;letter-spacing:-0.02em;">${escapeHtml(input.brandName)}</td></tr>`;
}
