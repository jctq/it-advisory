import { NextResponse } from 'next/server';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

/**
 * Returns the current marketing user, or null when signed out.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const user = await getAuthenticatedMarketingUser(request);
  return NextResponse.json({ user });
}
