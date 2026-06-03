import { createHash } from 'node:crypto';

export type RateLimitScope =
  | 'global_api'
  | 'auth_login'
  | 'auth_register'
  | 'auth_profile'
  | 'admin_login'
  | 'admin_otp_send'
  | 'admin_otp_verify'
  | 'guest_booking_lookup'
  | 'booking_availability'
  | 'booking_create'
  | 'booking_token_lookup'
  | 'payment_checkout_session'
  | 'diagnostic_session'
  | 'support_report'
  | 'support_report_reply'
  | 'diagnostic_ai';

const AUTH_LOGIN_LIMIT = 10 as const;
const AUTH_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const AUTH_REGISTER_LIMIT = 5 as const;
const AUTH_REGISTER_WINDOW_MS = 60 * 60 * 1000;
const ADMIN_LOGIN_LIMIT = 5 as const;
const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_OTP_SEND_LIMIT = 5 as const;
const ADMIN_OTP_SEND_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_OTP_VERIFY_LIMIT = 10 as const;
const ADMIN_OTP_VERIFY_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_OTP_EMAIL_SEND_LIMIT = 3 as const;
const ADMIN_OTP_EMAIL_SEND_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_OTP_EMAIL_VERIFY_LIMIT = 10 as const;
const ADMIN_OTP_EMAIL_VERIFY_WINDOW_MS = 15 * 60 * 1000;
const GUEST_BOOKING_LOOKUP_LIMIT = 20 as const;
const GUEST_BOOKING_LOOKUP_WINDOW_MS = 60 * 60 * 1000;
const SUPPORT_REPORT_LIMIT = 5 as const;
const SUPPORT_REPORT_WINDOW_MS = 60 * 60 * 1000;
const DIAGNOSTIC_AI_DEFAULT_LIMIT_PER_HOUR = 30 as const;
const DIAGNOSTIC_AI_WINDOW_MS = 60 * 60 * 1000;
const BOOKING_CREATE_DEFAULT_LIMIT_PER_HOUR = 10 as const;
const BOOKING_CREATE_WINDOW_MS = 60 * 60 * 1000;
const BOOKING_TOKEN_LOOKUP_DEFAULT_LIMIT_PER_HOUR = 30 as const;
const BOOKING_TOKEN_LOOKUP_WINDOW_MS = 60 * 60 * 1000;
const DIAGNOSTIC_SESSION_DEFAULT_LIMIT_PER_HOUR = 60 as const;
const DIAGNOSTIC_SESSION_WINDOW_MS = 60 * 60 * 1000;
const AUTH_PROFILE_LIMIT = 20 as const;
const AUTH_PROFILE_WINDOW_MS = 60 * 60 * 1000;
const GLOBAL_API_DEFAULT_LIMIT_PER_MINUTE = 120 as const;
const GLOBAL_API_WINDOW_MS = 60 * 1000;
const BOOKING_AVAILABILITY_DEFAULT_LIMIT_PER_HOUR = 60 as const;
const BOOKING_AVAILABILITY_WINDOW_MS = 60 * 60 * 1000;
const PAYMENT_CHECKOUT_SESSION_DEFAULT_LIMIT_PER_HOUR = 10 as const;
const PAYMENT_CHECKOUT_SESSION_WINDOW_MS = 60 * 60 * 1000;
const SUPPORT_REPORT_REPLY_LIMIT = 10 as const;
const SUPPORT_REPORT_REPLY_WINDOW_MS = 60 * 60 * 1000;

function readEnvLimitPerHour(envName: string, defaultLimit: number): number {
  const raw = process.env[envName]?.trim() ?? '';
  if (raw.length === 0) {
    return defaultLimit;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return defaultLimit;
  }
  return parsed;
}

function readDiagnosticAiLimit(): number {
  return readEnvLimitPerHour('RATE_LIMIT_DIAGNOSTIC_AI_PER_HOUR', DIAGNOSTIC_AI_DEFAULT_LIMIT_PER_HOUR);
}

function readEnvLimitPerMinute(envName: string, defaultLimit: number): number {
  const raw = process.env[envName]?.trim() ?? '';
  if (raw.length === 0) {
    return defaultLimit;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return defaultLimit;
  }
  return parsed;
}

export function resolveRateLimitPolicy(scope: RateLimitScope): { readonly limit: number; readonly windowMs: number } {
  switch (scope) {
    case 'global_api':
      return {
        limit: readEnvLimitPerMinute('RATE_LIMIT_GLOBAL_API_PER_MINUTE', GLOBAL_API_DEFAULT_LIMIT_PER_MINUTE),
        windowMs: GLOBAL_API_WINDOW_MS,
      };
    case 'auth_login':
      return { limit: AUTH_LOGIN_LIMIT, windowMs: AUTH_LOGIN_WINDOW_MS };
    case 'auth_register':
      return { limit: AUTH_REGISTER_LIMIT, windowMs: AUTH_REGISTER_WINDOW_MS };
    case 'auth_profile':
      return { limit: AUTH_PROFILE_LIMIT, windowMs: AUTH_PROFILE_WINDOW_MS };
    case 'admin_login':
      return { limit: ADMIN_LOGIN_LIMIT, windowMs: ADMIN_LOGIN_WINDOW_MS };
    case 'admin_otp_send':
      return { limit: ADMIN_OTP_SEND_LIMIT, windowMs: ADMIN_OTP_SEND_WINDOW_MS };
    case 'admin_otp_verify':
      return { limit: ADMIN_OTP_VERIFY_LIMIT, windowMs: ADMIN_OTP_VERIFY_WINDOW_MS };
    case 'guest_booking_lookup':
      return { limit: GUEST_BOOKING_LOOKUP_LIMIT, windowMs: GUEST_BOOKING_LOOKUP_WINDOW_MS };
    case 'booking_availability':
      return {
        limit: readEnvLimitPerHour(
          'RATE_LIMIT_BOOKING_AVAILABILITY_PER_HOUR',
          BOOKING_AVAILABILITY_DEFAULT_LIMIT_PER_HOUR,
        ),
        windowMs: BOOKING_AVAILABILITY_WINDOW_MS,
      };
    case 'booking_create':
      return {
        limit: readEnvLimitPerHour('RATE_LIMIT_BOOKING_CREATE_PER_HOUR', BOOKING_CREATE_DEFAULT_LIMIT_PER_HOUR),
        windowMs: BOOKING_CREATE_WINDOW_MS,
      };
    case 'booking_token_lookup':
      return {
        limit: readEnvLimitPerHour('RATE_LIMIT_BOOKING_TOKEN_LOOKUP_PER_HOUR', BOOKING_TOKEN_LOOKUP_DEFAULT_LIMIT_PER_HOUR),
        windowMs: BOOKING_TOKEN_LOOKUP_WINDOW_MS,
      };
    case 'diagnostic_session':
      return {
        limit: readEnvLimitPerHour('RATE_LIMIT_DIAGNOSTIC_SESSION_PER_HOUR', DIAGNOSTIC_SESSION_DEFAULT_LIMIT_PER_HOUR),
        windowMs: DIAGNOSTIC_SESSION_WINDOW_MS,
      };
    case 'payment_checkout_session':
      return {
        limit: readEnvLimitPerHour(
          'RATE_LIMIT_PAYMENT_CHECKOUT_SESSION_PER_HOUR',
          PAYMENT_CHECKOUT_SESSION_DEFAULT_LIMIT_PER_HOUR,
        ),
        windowMs: PAYMENT_CHECKOUT_SESSION_WINDOW_MS,
      };
    case 'support_report':
      return { limit: SUPPORT_REPORT_LIMIT, windowMs: SUPPORT_REPORT_WINDOW_MS };
    case 'support_report_reply':
      return { limit: SUPPORT_REPORT_REPLY_LIMIT, windowMs: SUPPORT_REPORT_REPLY_WINDOW_MS };
    case 'diagnostic_ai':
      return { limit: readDiagnosticAiLimit(), windowMs: DIAGNOSTIC_AI_WINDOW_MS };
  }
}

function readClientIp(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for')?.trim() ?? '';
  if (forwarded.length > 0) {
    const first = forwarded.split(',')[0]?.trim() ?? '';
    if (first.length > 0) {
      return first;
    }
  }
  const realIp = request.headers.get('x-real-ip')?.trim() ?? '';
  return realIp.length > 0 ? realIp : null;
}

function hashFallbackIdentifier(request: Request): string {
  const userAgent = request.headers.get('user-agent')?.trim() ?? 'unknown';
  return createHash('sha256').update(userAgent).digest('hex').slice(0, 32);
}

export function resolveAdminOtpEmailSendPolicy(): { readonly limit: number; readonly windowMs: number } {
  return { limit: ADMIN_OTP_EMAIL_SEND_LIMIT, windowMs: ADMIN_OTP_EMAIL_SEND_WINDOW_MS };
}

export function resolveAdminOtpEmailVerifyPolicy(): { readonly limit: number; readonly windowMs: number } {
  return { limit: ADMIN_OTP_EMAIL_VERIFY_LIMIT, windowMs: ADMIN_OTP_EMAIL_VERIFY_WINDOW_MS };
}

/**
 * Stable key for rate limiting (IP when present, otherwise hashed user-agent).
 */
export function resolveRateLimitIdentifier(request: Request): string {
  const ip = readClientIp(request);
  if (ip !== null) {
    return `ip:${ip}`;
  }
  return `ua:${hashFallbackIdentifier(request)}`;
}
