import NextAuth, { type NextAuthConfig } from 'next-auth';
import Google from 'next-auth/providers/google';
import MicrosoftEntraID from 'next-auth/providers/microsoft-entra-id';
import { isAdminEmailAllowed } from '@/lib/server/admin-allowed-emails';
import { recordSecurityEvent } from '@/lib/server/security-audit-log';

function buildProviders(): NextAuthConfig['providers'] {
  const providers: NextAuthConfig['providers'] = [];
  const googleId = process.env.AUTH_GOOGLE_ID?.trim() ?? '';
  const googleSecret = process.env.AUTH_GOOGLE_SECRET?.trim() ?? '';
  if (googleId.length > 0 && googleSecret.length > 0) {
    providers.push(
      Google({
        clientId: googleId,
        clientSecret: googleSecret,
        authorization: {
          params: {
            prompt: 'select_account',
          },
        },
      }),
    );
  }
  const microsoftId = process.env.AUTH_MICROSOFT_ENTRA_ID_ID?.trim() ?? '';
  const microsoftSecret = process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET?.trim() ?? '';
  if (microsoftId.length > 0 && microsoftSecret.length > 0) {
    providers.push(
      MicrosoftEntraID({
        clientId: microsoftId,
        clientSecret: microsoftSecret,
        issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER?.trim(),
        authorization: {
          params: {
            prompt: 'select_account',
          },
        },
      }),
    );
  }
  return providers;
}

const authConfig = {
  trustHost: true,
  providers: buildProviders(),
  session: { strategy: 'jwt', maxAge: 60 * 60 * 12 },
  pages: {
    signIn: '/admin/login',
    error: '/admin/auth-error',
  },
  callbacks: {
    signIn({ user }) {
      const allowed = isAdminEmailAllowed(user.email);
      void recordSecurityEvent({
        type: allowed ? 'admin_login_success' : 'admin_login_failure',
        outcome: allowed ? 'success' : 'blocked',
        metadata: { channel: 'oauth' },
      }).catch(() => undefined);
      return allowed;
    },
    jwt({ token, user }) {
      if (user?.email !== undefined && user.email !== null) {
        token.email = user.email;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user !== undefined && typeof token.email === 'string') {
        session.user.email = token.email;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
