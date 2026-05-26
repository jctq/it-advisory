import { BRAND_LOGO_COMPACT_DARK, BRAND_LOGO_COMPACT_LIGHT, brandAssetUrl } from '@/lib/brand/brand-assets';

export const TRANSACTIONAL_EMAIL_LOGO_WIDTH_PX = 152 as const;

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

type TransactionalEmailCompactLogoUrls = {
  readonly light: string;
  readonly dark: string;
};

function resolveTransactionalEmailCompactLogoUrls(siteOrigin: string): TransactionalEmailCompactLogoUrls | null {
  const origin = siteOrigin.trim().replace(/\/$/, '');
  if (origin.length === 0) {
    return null;
  }
  return {
    light: `${origin}${brandAssetUrl(BRAND_LOGO_COMPACT_LIGHT)}`,
    dark: `${origin}${brandAssetUrl(BRAND_LOGO_COMPACT_DARK)}`,
  };
}

/** True when compact logo assets can be loaded from the public site origin. */
export function resolveTransactionalEmailLogoUrl(siteOrigin: string): string | null {
  const urls = resolveTransactionalEmailCompactLogoUrls(siteOrigin);
  return urls?.light ?? null;
}

/** Lets Apple Mail / Gmail honor light and dark logo variants without a solid header band. */
export function buildTransactionalEmailColorSchemeHead(): string {
  return `<meta name="color-scheme" content="light dark" />
<meta name="supported-color-schemes" content="light dark" />
<style type="text/css">
.email-logo-light { display: block !important; max-height: none !important; overflow: visible !important; }
.email-logo-dark { display: none !important; max-height: 0 !important; overflow: hidden !important; mso-hide: all; }
@media (prefers-color-scheme: dark) {
  .email-logo-light { display: none !important; max-height: 0 !important; overflow: hidden !important; mso-hide: all; }
  .email-logo-dark { display: block !important; max-height: none !important; overflow: visible !important; }
}
</style>`;
}

function buildTransactionalEmailLogoImg(input: {
  readonly className: string;
  readonly logoUrl: string;
  readonly brandName: string;
}): string {
  return `<img class="${input.className}" src="${escapeHtml(input.logoUrl)}" width="${TRANSACTIONAL_EMAIL_LOGO_WIDTH_PX}" alt="${escapeHtml(input.brandName)}" style="display:block;width:${TRANSACTIONAL_EMAIL_LOGO_WIDTH_PX}px;max-width:100%;height:auto;border:0;outline:none;text-decoration:none;background-color:transparent;" />`;
}

/** Compact wordmark row (same assets as the site header); transparent background so PNG alpha shows through. */
export function buildTransactionalEmailLogoHeaderRow(input: {
  readonly siteOrigin: string;
  readonly brandName: string;
}): string {
  const logoUrls = resolveTransactionalEmailCompactLogoUrls(input.siteOrigin);
  if (logoUrls === null) {
    return '';
  }
  const lightImg = buildTransactionalEmailLogoImg({
    className: 'email-logo-light',
    logoUrl: logoUrls.light,
    brandName: input.brandName,
  });
  const darkImg = buildTransactionalEmailLogoImg({
    className: 'email-logo-dark',
    logoUrl: logoUrls.dark,
    brandName: input.brandName,
  });
  return `<tr><td align="left" style="padding:24px 28px;background-color:transparent;">${lightImg}${darkImg}</td></tr>`;
}

export function buildTransactionalEmailBrandNameRow(input: {
  readonly brandName: string;
  readonly fontStack: string;
}): string {
  return `<tr><td style="padding:0 0 16px 0;font-family:${input.fontStack};font-size:22px;font-weight:700;line-height:28px;color:#0f172a;letter-spacing:-0.02em;">${escapeHtml(input.brandName)}</td></tr>`;
}
