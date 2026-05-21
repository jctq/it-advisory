import { HomePageContent } from './home-page-content';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { buildMarketingMetadata } from '@/lib/seo/site-seo';

export const metadata = buildMarketingMetadata({
  title: 'TechMD for Growing Businesses',
  description:
    'Independent, vendor-neutral IT guidance for Philippine businesses — from diagnostic to booking.',
  pathname: '/',
});

export default async function HomePage() {
  const user = await getAuthenticatedMarketingUser();
  return <HomePageContent isAuthenticated={user !== null} />;
}
