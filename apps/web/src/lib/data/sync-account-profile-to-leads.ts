import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { LeadDocument } from '@/domain/types';
import {
  buildMarketingLeadContactFromAccountUser,
  leadNeedsProfileSync,
} from '@/lib/marketing/account-profile-lead-contact';
import { findUserById } from '@/lib/data/users';
import { getDb } from '@/lib/mongodb';

export type SyncAccountProfileToLeadsResult =
  | { readonly ok: true; readonly updatedLeadIds: readonly string[] }
  | {
      readonly ok: false;
      readonly code: 'not_account_visitor' | 'user_not_found' | 'profile_incomplete';
      readonly message: string;
    };

const ACCOUNT_VISITOR_ID = /^acct:([a-f0-9]{24})$/i;

function parseAccountVisitorUserId(accountVisitorId: string): ObjectId | null {
  const match = ACCOUNT_VISITOR_ID.exec(accountVisitorId.trim());
  if (match === null || match[1] === undefined) {
    return null;
  }
  try {
    return new ObjectId(match[1]);
  } catch {
    return null;
  }
}

/**
 * Copies the signed-in account profile onto marketing lead rows for this visitor (and optional lead id).
 */
export async function syncAccountProfileToVisitorLeads(
  accountVisitorId: string,
  options?: { readonly leadId?: ObjectId },
): Promise<SyncAccountProfileToLeadsResult> {
  if (!process.env.MONGODB_URI) {
    return { ok: false, code: 'profile_incomplete', message: 'Database is not configured.' };
  }
  const userId = parseAccountVisitorUserId(accountVisitorId);
  if (userId === null) {
    return { ok: false, code: 'not_account_visitor', message: 'Not a signed-in account visitor.' };
  }
  const user = await findUserById(userId);
  if (user === null) {
    return { ok: false, code: 'user_not_found', message: 'Account not found.' };
  }
  const contact = buildMarketingLeadContactFromAccountUser(user);
  if (contact === null) {
    return {
      ok: false,
      code: 'profile_incomplete',
      message: 'Add a valid email on your account profile before syncing.',
    };
  }
  const db = await getDb();
  const filter: Record<string, unknown> = { visitorId: accountVisitorId };
  if (options?.leadId !== undefined) {
    filter._id = options.leadId;
  }
  const leadDocs = await db.collection<LeadDocument>(COLLECTIONS.leads).find(filter).toArray();
  const updatedLeadIds: string[] = [];
  for (const leadDoc of leadDocs) {
    if (leadDoc._id === undefined) {
      continue;
    }
    if (!leadNeedsProfileSync(leadDoc)) {
      continue;
    }
    await db.collection<LeadDocument>(COLLECTIONS.leads).updateOne(
      { _id: leadDoc._id },
      {
        $set: {
          name: contact.name,
          email: contact.email,
          company: contact.company,
          phone: contact.phone,
        },
      },
    );
    updatedLeadIds.push(leadDoc._id.toString());
  }
  return { ok: true, updatedLeadIds };
}

export function isAccountVisitorId(visitorId: string): boolean {
  return ACCOUNT_VISITOR_ID.test(visitorId.trim());
}

export { buildMarketingLeadContactFromAccountUser, leadNeedsProfileSync };
