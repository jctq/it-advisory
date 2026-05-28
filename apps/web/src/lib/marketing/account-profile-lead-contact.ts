import type { LeadDocument, UserAccountDocument } from '@/domain/types';
import type { MarketingBookingLeadContact } from '@/lib/data/leads';

function readLeadEmail(lead: LeadDocument): string {
  if (typeof lead.email !== 'string') {
    return '';
  }
  return lead.email.trim();
}

/**
 * Whether a marketing lead row should be updated from the signed-in account profile.
 */
export function leadNeedsProfileSync(lead: LeadDocument): boolean {
  const email = readLeadEmail(lead);
  if (email.length === 0) {
    return true;
  }
  const name = typeof lead.name === 'string' ? lead.name.trim() : '';
  if (name.length === 0 || name === 'Booking (funnel)') {
    return true;
  }
  const phone = typeof lead.phone === 'string' ? lead.phone.trim() : '';
  if (phone.length === 0 || phone === '—') {
    return true;
  }
  return false;
}

/**
 * Builds marketing lead contact fields from a signed-in account document.
 */
export function buildMarketingLeadContactFromAccountUser(
  user: Pick<UserAccountDocument, 'emailNormalized' | 'fullName' | 'company' | 'phone'> | null,
): MarketingBookingLeadContact | null {
  if (user === null) {
    return null;
  }
  const email = user.emailNormalized.trim();
  if (email.length === 0) {
    return null;
  }
  const fullName = user.fullName?.trim() ?? '';
  const name = fullName.length >= 2 ? fullName : 'Account holder';
  const companyRaw = user.company?.trim() ?? '';
  const phoneRaw = user.phone?.trim() ?? '';
  return {
    name,
    email,
    company: companyRaw.length > 0 ? companyRaw : '—',
    phone: phoneRaw.length > 0 ? phoneRaw : '—',
  };
}
