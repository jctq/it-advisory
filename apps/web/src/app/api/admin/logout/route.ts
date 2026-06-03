import { signOut } from '@/auth';

/**
 * Signs out of the admin NextAuth session and redirects to the login page.
 */
export async function POST(): Promise<Response> {
  return signOut({ redirectTo: '/admin/login' });
}
