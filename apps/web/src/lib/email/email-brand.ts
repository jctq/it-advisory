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

export function buildTransactionalEmailBrandNameRow(input: {
  readonly brandName: string;
  readonly fontStack: string;
}): string {
  return `<tr><td style="padding:0 0 16px 0;font-family:${input.fontStack};font-size:22px;font-weight:700;line-height:28px;color:#0f172a;letter-spacing:-0.02em;">${escapeHtml(input.brandName)}</td></tr>`;
}
