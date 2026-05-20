import type { ReactElement } from 'react';
import { SiteHeaderClient } from '@/components/marketing/site-header-client';
import { readManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

/**
 * Marketing site chrome: resolves the optional signed-in user on the server, then hydrates interactivity on the client.
 */
export async function SiteHeader({ className }: { readonly className?: string }): Promise<ReactElement> {
  const [marketingUser, manageBookingEnabled] = await Promise.all([
    getAuthenticatedMarketingUser(),
    readManageBookingEnabled(),
  ]);
  return (
    <SiteHeaderClient
      marketingUser={marketingUser}
      manageBookingEnabled={manageBookingEnabled}
      className={className}
    />
  );
}
