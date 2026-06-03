import { NextResponse } from 'next/server';
import { issueAdminOtpChallenge } from '@/lib/data/admin-otp-challenges';
import { executeSendAdminLoginOtpEmail } from '@/lib/email/send-admin-login-otp-email';
import { requireAdminPendingOtpSession } from '@/lib/server/admin-otp-session';
import { jsonApiError } from '@/lib/server/api-error-response';
import {
  executeRateLimitOrResponse,
  resolveRateLimitIdentifier,
} from '@/lib/server/rate-limit';
import {
  resolveAdminOtpEmailSendPolicy,
} from '@/lib/server/rate-limit-policy';
import { recordSecurityEvent } from '@/lib/server/security-audit-log';

export async function POST(request: Request): Promise<NextResponse> {
  const access = await requireAdminPendingOtpSession(request);
  if (!access.authorized) {
    return access.response;
  }
  const ipLimited = await executeRateLimitOrResponse(request, 'admin_otp_send');
  if (ipLimited !== null) {
    return ipLimited;
  }
  const emailPolicy = resolveAdminOtpEmailSendPolicy();
  const emailLimited = await executeRateLimitOrResponse(request, 'admin_otp_send', {
    identifier: `email:${access.email}`,
    limit: emailPolicy.limit,
    windowMs: emailPolicy.windowMs,
  });
  if (emailLimited !== null) {
    return emailLimited;
  }
  const challenge = await issueAdminOtpChallenge(access.email);
  if (!challenge.ok) {
    return jsonApiError({
      error: 'Please wait before requesting another code.',
      code: 'admin_otp_cooldown',
      status: 429,
      headers: new Headers({ 'Retry-After': String(challenge.retryAfterSeconds) }),
    });
  }
  const sendResult = await executeSendAdminLoginOtpEmail({
    to: access.email,
    code: challenge.code,
  });
  if (!sendResult.ok) {
    void recordSecurityEvent({
      type: 'admin_otp_send',
      request,
      path: '/api/admin/otp/send',
      outcome: 'failure',
      metadata: { emailHash: resolveRateLimitIdentifier(request).slice(0, 12) },
    }).catch(() => undefined);
    return jsonApiError({
      error: 'Unable to send verification email right now.',
      code: 'admin_otp_send_failed',
      status: 503,
    });
  }
  void recordSecurityEvent({
    type: 'admin_otp_send',
    request,
    path: '/api/admin/otp/send',
    outcome: 'success',
  }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
