import { ObjectId } from 'mongodb';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { syncAccountProfileToVisitorLeads } from '@/lib/data/sync-account-profile-to-leads';
import { findUserByEmailNormalized, findUserById, normalizeAccountEmail, updateUserProfileFields } from '@/lib/data/users';
import { buildAccountVisitorId } from '@/lib/server/marketing-auth';
import { buildMarketingUserPublicFromDocument } from '@/lib/marketing/marketing-user-public';
import { parsePhilippineMobileE164 } from '@/lib/marketing/philippine-profile-phone';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';

function isMongoDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && (err as { readonly code?: number }).code === 11000;
}

const profilePatchSchema = z
  .object({
    email: z.string().trim().email({ message: 'Enter a valid email address.' }).max(254),
    fullName: z.string().max(150),
    company: z.string().max(200),
    phone: z.string().max(40),
  })
  .strict()
  .superRefine((body, ctx) => {
    const name = body.fullName.trim();
    if (name.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter your full name (at least 2 characters).',
        path: ['fullName'],
      });
    }
    const e164 = parsePhilippineMobileE164(body.phone);
    if (e164 === null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Enter a valid Philippine mobile number (+63, 10 digits starting with 9).',
        path: ['phone'],
      });
    }
  });

/**
 * Updates signed-in marketing profile fields (name, email, company, phone). Phone must be Philippine +63 mobile.
 */
export async function PATCH(request: Request): Promise<NextResponse> {
  const auth = await getAuthenticatedMarketingUser(request);
  if (auth === null) {
    return NextResponse.json({ error: 'Sign in required', code: 'auth_required' }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = profilePatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const userId = new ObjectId(auth.id);
  const doc = await findUserById(userId);
  if (doc === null) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }
  const emailNormalized = normalizeAccountEmail(parsed.data.email);
  const phoneE164 = parsePhilippineMobileE164(parsed.data.phone)!;
  if (emailNormalized !== doc.emailNormalized) {
    const existing = await findUserByEmailNormalized(emailNormalized);
    if (existing !== null && !existing._id.equals(userId)) {
      return NextResponse.json({ error: 'That email address is already registered.', code: 'email_taken' }, { status: 409 });
    }
  }
  const updateInput = {
    fullName: parsed.data.fullName.trim(),
    company: parsed.data.company.trim(),
    phone: phoneE164,
    ...(emailNormalized !== doc.emailNormalized ? { emailNormalized } : {}),
  };
  try {
    const updated = await updateUserProfileFields(userId, updateInput);
    if (!updated) {
      return NextResponse.json({ error: 'Account not found' }, { status: 404 });
    }
  } catch (err: unknown) {
    if (isMongoDuplicateKeyError(err)) {
      return NextResponse.json({ error: 'That email address is already registered.', code: 'email_taken' }, { status: 409 });
    }
    throw err;
  }
  const refreshed = await findUserById(userId);
  if (refreshed === null) {
    return NextResponse.json({ error: 'Account not found' }, { status: 404 });
  }
  await syncAccountProfileToVisitorLeads(buildAccountVisitorId(userId.toHexString()));
  return NextResponse.json({ user: buildMarketingUserPublicFromDocument(refreshed) });
}
