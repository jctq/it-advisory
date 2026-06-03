import { signOut } from '@/auth';
import { revokeAdminOtpVerification } from '@/lib/data/admin-otp-verifications';
import { resolveAdminOtpSessionState } from '@/lib/server/admin-otp-session';

/**
 * Signs out of the admin NextAuth session and redirects to the login page.
 */
export async function POST(request: Request): Promise<Response> {
  const state = await resolveAdminOtpSessionState(request);
  if (state.email !== null) {
    await revokeAdminOtpVerification(state.email);
  }
  return signOut({ redirectTo: '/admin/login' });
}
