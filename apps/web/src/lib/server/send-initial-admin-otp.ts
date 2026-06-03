import 'server-only';
import { headers } from 'next/headers';
import { issueAdminOtpChallenge } from '@/lib/data/admin-otp-challenges';
import { executeSendAdminLoginOtpEmail } from '@/lib/email/send-admin-login-otp-email';
import { assertRateLimit, RateLimitedError } from '@/lib/server/rate-limit';
import { resolveAdminOtpEmailSendPolicy } from '@/lib/server/rate-limit-policy';
import { recordSecurityEvent } from '@/lib/server/security-audit-log';

export type SendInitialAdminOtpResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'cooldown' | 'send_failed' | 'rate_limited' };

async function buildRateLimitRequestFromHeaders(pathname: string): Promise<Request> {
  const headerList = await headers();
  const requestHeaders = new Headers();
  const forwarded = headerList.get('x-forwarded-for');
  const realIp = headerList.get('x-real-ip');
  const userAgent = headerList.get('user-agent');
  if (forwarded !== null) {
    requestHeaders.set('x-forwarded-for', forwarded);
  }
  if (realIp !== null) {
    requestHeaders.set('x-real-ip', realIp);
  }
  if (userAgent !== null) {
    requestHeaders.set('user-agent', userAgent);
  }
  return new Request(`http://local${pathname}`, { headers: requestHeaders });
}

/**
 * Sends the first OTP email when an admin lands on the verification page.
 */
export async function executeSendInitialAdminOtp(input: {
  readonly email: string;
}): Promise<SendInitialAdminOtpResult> {
  const request = await buildRateLimitRequestFromHeaders('/admin/verify-otp');
  try {
    await assertRateLimit({ request, scope: 'admin_otp_send' });
    const emailPolicy = resolveAdminOtpEmailSendPolicy();
    await assertRateLimit({
      request,
      scope: 'admin_otp_send',
      identifier: `email:${input.email.trim().toLowerCase()}`,
      limit: emailPolicy.limit,
      windowMs: emailPolicy.windowMs,
    });
  } catch (error: unknown) {
    if (error instanceof RateLimitedError) {
      return { ok: false, reason: 'rate_limited' };
    }
    throw error;
  }
  const challenge = await issueAdminOtpChallenge(input.email);
  if (!challenge.ok) {
    return { ok: false, reason: 'cooldown' };
  }
  const sendResult = await executeSendAdminLoginOtpEmail({
    to: input.email,
    code: challenge.code,
  });
  if (!sendResult.ok) {
    void recordSecurityEvent({
      type: 'admin_otp_send',
      request,
      path: '/admin/verify-otp',
      outcome: 'failure',
    }).catch(() => undefined);
    return { ok: false, reason: 'send_failed' };
  }
  void recordSecurityEvent({
    type: 'admin_otp_send',
    request,
    path: '/admin/verify-otp',
    outcome: 'success',
  }).catch(() => undefined);
  return { ok: true };
}
