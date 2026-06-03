import { NextResponse } from 'next/server';
import { z } from 'zod';
import { grantAdminOtpVerification } from '@/lib/data/admin-otp-verifications';
import { verifyAdminOtpCode } from '@/lib/data/admin-otp-challenges';
import { requireAdminPendingOtpSession } from '@/lib/server/admin-otp-session';
import { jsonApiError, jsonApiValidationError } from '@/lib/server/api-error-response';
import { executeRateLimitOrResponse } from '@/lib/server/rate-limit';
import { resolveAdminOtpEmailVerifyPolicy } from '@/lib/server/rate-limit-policy';
import { recordSecurityEvent } from '@/lib/server/security-audit-log';
import { executeUniformGuestLookupDelay } from '@/lib/server/uniform-response-delay';

const verifyBodySchema = z.object({
  code: z.string().trim().regex(/^\d{6}$/),
});

export async function POST(request: Request): Promise<NextResponse> {
  const access = await requireAdminPendingOtpSession(request);
  if (!access.authorized) {
    return access.response;
  }
  const ipLimited = await executeRateLimitOrResponse(request, 'admin_otp_verify');
  if (ipLimited !== null) {
    return ipLimited;
  }
  const emailPolicy = resolveAdminOtpEmailVerifyPolicy();
  const emailLimited = await executeRateLimitOrResponse(request, 'admin_otp_verify', {
    identifier: `email:${access.email}`,
    limit: emailPolicy.limit,
    windowMs: emailPolicy.windowMs,
  });
  if (emailLimited !== null) {
    return emailLimited;
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonApiError({
      error: 'Invalid JSON body',
      code: 'invalid_json',
      status: 400,
    });
  }
  const parsed = verifyBodySchema.safeParse(body);
  if (!parsed.success) {
    return jsonApiValidationError(parsed.error, { code: 'validation_failed' });
  }
  const verification = await verifyAdminOtpCode(access.email, parsed.data.code);
  await executeUniformGuestLookupDelay();
  if (!verification.ok) {
    void recordSecurityEvent({
      type: 'admin_otp_verify_failure',
      request,
      path: '/api/admin/otp/verify',
      outcome: 'failure',
      metadata: { reason: verification.reason },
    }).catch(() => undefined);
    return jsonApiError({
      error: 'Invalid or expired verification code.',
      code: 'admin_otp_invalid',
      status: 400,
    });
  }
  await grantAdminOtpVerification(access.email);
  void recordSecurityEvent({
    type: 'admin_otp_verify_success',
    request,
    path: '/api/admin/otp/verify',
    outcome: 'success',
  }).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
