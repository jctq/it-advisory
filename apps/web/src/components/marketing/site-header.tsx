import type { ReactElement } from 'react';
import { SiteHeaderClient } from '@/components/marketing/site-header-client';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

/**
 * Marketing site chrome: resolves the optional signed-in user on the server, then hydrates interactivity on the client.
 */
export async function SiteHeader({ className }: { readonly className?: string }): Promise<ReactElement> {
  const marketingUser = await getAuthenticatedMarketingUser();
  return <SiteHeaderClient marketingUser={marketingUser} className={className} />;
}
