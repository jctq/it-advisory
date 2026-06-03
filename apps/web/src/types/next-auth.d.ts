import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      email?: string | null;
      otpVerified?: boolean;
    };
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    email?: string;
    otpVerified?: boolean;
  }
}
