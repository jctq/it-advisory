import { getResolvedSiteName } from '@/lib/data/app-settings';
import { buildTransactionalEmailBrandNameRow } from '@/lib/email/email-brand';
import { executeDispatchTransactionalEmail } from '@/lib/email/send-transactional-email';

const EMAIL_INNER_WIDTH_PX = 600;
const EMAIL_FONT_STACK =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif";

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildAdminLoginOtpEmailHtml(input: {
  readonly brandName: string;
  readonly code: string;
  readonly expiresMinutes: number;
}): string {
  const codeMarkup = input.code
    .split('')
    .map(
      (digit) =>
        `<span style="display:inline-block;min-width:28px;padding:10px 8px;margin:0 4px;border:1px solid #d4d4d8;border-radius:8px;font-family:${EMAIL_FONT_STACK};font-size:22px;font-weight:700;line-height:1;color:#18181b;text-align:center;background:#fafafa;">${escapeHtml(digit)}</span>`,
    )
    .join('');
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px;background:#f4f4f5;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td align="center"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="${EMAIL_INNER_WIDTH_PX}" style="max-width:100%;background:#ffffff;border:1px solid #e4e4e7;border-radius:12px;"><tr><td style="padding:28px 32px;">${buildTransactionalEmailBrandNameRow({ brandName: input.brandName, fontStack: EMAIL_FONT_STACK })}<tr><td style="padding:0 0 12px 0;font-family:${EMAIL_FONT_STACK};font-size:24px;font-weight:700;line-height:32px;color:#18181b;">Verify your admin sign-in</td></tr><tr><td style="padding:0 0 20px 0;font-family:${EMAIL_FONT_STACK};font-size:15px;line-height:24px;color:#52525b;">Use this verification code to finish signing in to the admin panel. It expires in ${input.expiresMinutes} minutes.</td></tr><tr><td style="padding:0 0 20px 0;text-align:center;">${codeMarkup}</td></tr><tr><td style="padding:0;font-family:${EMAIL_FONT_STACK};font-size:13px;line-height:20px;color:#71717a;">If you did not try to sign in, you can ignore this email.</td></tr></td></tr></table></td></tr></table></body></html>`;
}

/**
 * Sends the admin login OTP to the allowlisted email address.
 */
export async function executeSendAdminLoginOtpEmail(input: {
  readonly to: string;
  readonly code: string;
}): Promise<{ readonly ok: boolean; readonly errorMessage?: string }> {
  const brandName = await getResolvedSiteName();
  const subject = `${brandName} admin sign-in code`;
  const text = `Your ${brandName} admin sign-in code is ${input.code}. It expires in 10 minutes.`;
  const html = buildAdminLoginOtpEmailHtml({
    brandName,
    code: input.code,
    expiresMinutes: 10,
  });
  const outcome = await executeDispatchTransactionalEmail({
    to: input.to,
    subject,
    html,
    text,
  });
  if (outcome.kind === 'sent' || outcome.kind === 'audit_only') {
    return { ok: true };
  }
  return { ok: false, errorMessage: outcome.errorMessage };
}
