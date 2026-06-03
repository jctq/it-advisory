import { Suspense } from 'react';
import { AdminVerifyOtpForm } from '@/components/admin/admin-verify-otp-form';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import { isAdminEmailAllowed } from '@/lib/server/admin-allowed-emails';
import { isAdminEmailOtpRequired } from '@/lib/server/admin-email-otp-config';
import { executeSendInitialAdminOtp } from '@/lib/server/send-initial-admin-otp';

export const metadata = {
  title: 'Verify admin sign-in — TeqMD',
};

export default async function AdminVerifyOtpPage(): Promise<React.ReactElement> {
  if (!isAdminEmailOtpRequired()) {
    redirect('/admin/diagnostic-templates');
  }
  const session = await auth();
  const email = session?.user?.email ?? null;
  if (email === null || !isAdminEmailAllowed(email)) {
    redirect('/admin/login');
  }
  if (session?.user?.otpVerified === true) {
    redirect('/admin/diagnostic-templates');
  }
  const initialSend = await executeSendInitialAdminOtp({ email });
  const initialSendFailed = !initialSend.ok;
  const initialResendLocked = initialSend.ok || initialSend.reason === 'cooldown';
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-12">
      <Suspense fallback={null}>
        <AdminVerifyOtpForm
          email={email}
          initialSendFailed={initialSendFailed}
          initialResendLocked={initialResendLocked}
        />
      </Suspense>
    </main>
  );
}
