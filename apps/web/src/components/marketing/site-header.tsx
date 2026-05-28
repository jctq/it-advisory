import type { ReactElement } from 'react';
import { SiteHeaderClient } from '@/components/marketing/site-header-client';
import { readManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { readSupportModuleEnabled } from '@/lib/marketing/support-module-gate';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

/**
 * Marketing site chrome: resolves the optional signed-in user on the server, then hydrates interactivity on the client.
 */
export async function SiteHeader({
  className,
  supportModuleEnabled,
}: {
  readonly className?: string;
  readonly supportModuleEnabled?: boolean;
}): Promise<ReactElement> {
  const [marketingUser, manageBookingEnabled, resolvedSupportModuleEnabled] = await Promise.all([
    getAuthenticatedMarketingUser(),
    readManageBookingEnabled(),
    supportModuleEnabled === undefined ? readSupportModuleEnabled() : Promise.resolve(supportModuleEnabled),
  ]);
  return (
    <SiteHeaderClient
      marketingUser={marketingUser}
      manageBookingEnabled={manageBookingEnabled}
      supportModuleEnabled={resolvedSupportModuleEnabled}
      className={className}
    />
  );
}
