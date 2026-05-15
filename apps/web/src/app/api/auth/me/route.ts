import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { findUserById } from '@/lib/data/users';
import { buildMarketingUserPublicFromDocument } from '@/lib/marketing/marketing-user-public';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

/**
 * Returns the current marketing user (including optional profile fields), or null when signed out.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedMarketingUser(request);
  if (auth === null) {
    return NextResponse.json({ user: null });
  }
  const doc = await findUserById(new ObjectId(auth.id));
  if (doc === null) {
    return NextResponse.json({ user: null });
  }
  return NextResponse.json({ user: buildMarketingUserPublicFromDocument(doc) });
}
