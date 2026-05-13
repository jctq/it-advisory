import type { Metadata } from 'next';
import { HomePageContent } from './home-page-content';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

export const metadata: Metadata = {
  title: 'IT Advisory for Growing Businesses',
  description:
    'Independent, vendor-neutral IT guidance for Philippine businesses — from diagnostic to booking.',
};

export default async function HomePage() {
  const user = await getAuthenticatedMarketingUser();
  return <HomePageContent isAuthenticated={user !== null} />;
}
