import 'server-only';

const ADMIN_SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;

/**
 * When enabled, allowlisted admins must verify a one-time email code after OAuth sign-in.
 */
export function isAdminEmailOtpRequired(): boolean {
  return process.env.ADMIN_EMAIL_OTP_REQUIRED?.trim() === '1';
}

export function resolveAdminOtpVerificationTtlMs(): number {
  return ADMIN_SESSION_MAX_AGE_SECONDS * 1000;
}
