import { HomePageContent } from './home-page-content';
import { JsonLd } from '@/components/seo/json-ld';
import { getResolvedSiteName } from '@/lib/data/app-settings';
import { listPublishedMarketingTestimonials } from '@/lib/data/testimonials';
import { readReviewsModuleEnabled } from '@/lib/marketing/reviews-module-gate';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { buildHomePageJsonLd } from '@/lib/seo/marketing-page-structured-data';
import { buildPageMetadata } from '@/lib/seo/site-seo';

export async function generateMetadata() {
  return buildPageMetadata('home', { pathname: '/' });
}

export default async function HomePage() {
  const [user, siteName, reviewsModuleEnabled, testimonials] = await Promise.all([
    getAuthenticatedMarketingUser(),
    getResolvedSiteName(),
    readReviewsModuleEnabled(),
    listPublishedMarketingTestimonials(),
  ]);
  const structuredData = await buildHomePageJsonLd();
  return (
    <>
      {structuredData.length > 0 ? <JsonLd data={structuredData} /> : null}
      <HomePageContent
        isAuthenticated={user !== null}
        siteName={siteName}
        reviewsModuleEnabled={reviewsModuleEnabled}
        testimonials={testimonials}
      />
    </>
  );
}
