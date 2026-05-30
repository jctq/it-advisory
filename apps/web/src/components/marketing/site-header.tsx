import type { ReactElement } from 'react';
import { SiteHeaderClient } from '@/components/marketing/site-header-client';
import { listPublishedMarketingTestimonials } from '@/lib/data/testimonials';
import { readManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import { resolveMarketingCaseStudiesNavEnabled } from '@/lib/marketing/marketing-explore-nav-links';
import { readReviewsModuleEnabled } from '@/lib/marketing/reviews-module-gate';
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
  const [marketingUser, manageBookingEnabled, resolvedSupportModuleEnabled, reviewsModuleEnabled, testimonials] =
    await Promise.all([
      getAuthenticatedMarketingUser(),
      readManageBookingEnabled(),
      supportModuleEnabled === undefined ? readSupportModuleEnabled() : Promise.resolve(supportModuleEnabled),
      readReviewsModuleEnabled(),
      listPublishedMarketingTestimonials(),
    ]);
  const caseStudiesNavEnabled = resolveMarketingCaseStudiesNavEnabled({
    reviewsModuleEnabled,
    publishedTestimonialCount: testimonials.length,
  });
  return (
    <SiteHeaderClient
      marketingUser={marketingUser}
      manageBookingEnabled={manageBookingEnabled}
      supportModuleEnabled={resolvedSupportModuleEnabled}
      caseStudiesNavEnabled={caseStudiesNavEnabled}
      className={className}
    />
  );
}
