export type AdminAuthErrorPresentation = {
  readonly title: string;
  readonly message: string;
};

/**
 * Normalizes Auth.js error query values (e.g. `AccessDenied/signin` → `AccessDenied`).
 */
export function normalizeAdminAuthErrorCode(raw: string | undefined): string | null {
  if (raw === undefined || raw.trim().length === 0) {
    return null;
  }
  const base = raw.trim().split('/')[0] ?? '';
  return base.length > 0 ? base : null;
}

/**
 * Maps Auth.js error codes to user-facing copy for admin sign-in.
 */
export function resolveAdminAuthErrorPresentation(
  rawCode: string | undefined,
): AdminAuthErrorPresentation | null {
  const code = normalizeAdminAuthErrorCode(rawCode);
  if (code === null) {
    return null;
  }
  if (code === 'AccessDenied') {
    return {
      title: 'Access not approved',
      message:
        'You do not have permission to sign in to the admin panel with this account. If you believe this is a mistake, contact your TeqMD administrator.',
    };
  }
  if (code === 'Configuration') {
    return {
      title: 'Sign-in unavailable',
      message: 'Admin sign-in is not available right now. Please try again later or contact your administrator.',
    };
  }
  if (code === 'OAuthSignin' || code === 'OAuthCallback') {
    return {
      title: 'Sign-in could not be completed',
      message: 'We could not finish signing you in. Please try again in a few minutes.',
    };
  }
  if (code === 'OAuthAccountNotLinked') {
    return {
      title: 'Use your usual sign-in method',
      message:
        'This email is already linked to a different sign-in option. Try the same Google or Microsoft button you used before.',
    };
  }
  if (code === 'SessionRequired') {
    return {
      title: 'Session expired',
      message: 'Your session has ended. Please sign in again to continue.',
    };
  }
  return {
    title: 'Could not sign in',
    message: 'Something went wrong while signing you in. Please try again. If the problem continues, contact your administrator.',
  };
}
