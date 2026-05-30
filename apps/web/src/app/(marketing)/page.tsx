import { HomePageContent } from './home-page-content';
import { getResolvedSiteName } from '@/lib/data/app-settings';
import { listPublishedMarketingTestimonials } from '@/lib/data/testimonials';
import { readReviewsModuleEnabled } from '@/lib/marketing/reviews-module-gate';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { buildMarketingMetadata } from '@/lib/seo/site-seo';

export const metadata = buildMarketingMetadata({
  title: 'TeqMD for Growing Businesses',
  description:
    'Independent, vendor-neutral IT guidance for Philippine businesses — from diagnostic to booking.',
  pathname: '/',
});

export default async function HomePage() {
  const [user, siteName, reviewsModuleEnabled, testimonials] = await Promise.all([
    getAuthenticatedMarketingUser(),
    getResolvedSiteName(),
    readReviewsModuleEnabled(),
    listPublishedMarketingTestimonials(),
  ]);
  console.log('testimonials', testimonials);
  return (
    <HomePageContent
      isAuthenticated={user !== null}
      siteName={siteName}
      reviewsModuleEnabled={reviewsModuleEnabled}
      testimonials={testimonials}
    />
  );
}
