import type { ReactElement } from 'react';
import { ObjectId } from 'mongodb';
import { redirect } from 'next/navigation';
import { AccountProfileForm } from '@/components/marketing/account-profile-form';
import { findUserById } from '@/lib/data/users';
import { parseNationalDigitsFromStoredPhone } from '@/lib/marketing/philippine-profile-phone';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { buildNoIndexMetadata } from '@/lib/seo/site-seo';

export const metadata = buildNoIndexMetadata({
  title: 'Profile — TechMD',
  description: 'Manage your TechMD account profile.',
});

export const dynamic = 'force-dynamic';

export default async function AccountProfilePage(): Promise<ReactElement> {
  const auth = await getAuthenticatedMarketingUser();
  if (auth === null) {
    redirect('/login?next=%2Faccount%2Fprofile');
  }
  const doc = await findUserById(new ObjectId(auth.id));
  if (doc === null) {
    redirect('/login?next=%2Faccount%2Fprofile');
  }
  const initial = {
    email: doc.emailNormalized,
    fullName: doc.fullName !== undefined && doc.fullName.trim().length > 0 ? doc.fullName.trim() : '',
    company: doc.company !== undefined && doc.company.trim().length > 0 ? doc.company.trim() : '',
    phoneNationalDigits: parseNationalDigitsFromStoredPhone(doc.phone),
  };
  return (
    <main className="mx-auto max-w-6xl px-0 py-0 md:px-6 md:py-12">
      <div className="mb-8 hidden md:block">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Account</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">Profile</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Update the name, email, company, and mobile number we use for bookings and diagnostics.
        </p>
      </div>
      <AccountProfileForm initial={initial} />
    </main>
  );
}
