import 'server-only';

import { ObjectId } from 'mongodb';
import { COLLECTIONS } from '@/domain/collections';
import type { BookingDocument, LeadDocument, UserAccountDocument } from '@/domain/types';
import type { AdminBookingOverviewContext } from '@/lib/admin/admin-booking-overview-types';
import type { BookingDetailRow } from '@/lib/data/bookings';
import { getDb } from '@/lib/mongodb';
import { formatBookingReferenceId } from '@/lib/marketing/booking-reference';
import { resolveBookingSessionDisplayTitles } from '@/lib/marketing/resolve-booking-session-display-titles';
import { resolveCheckoutServiceTitle } from '@/lib/payments/resolve-checkout-service-title';

function formatLeadContactField(value: string | undefined): string | null {
  if (value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed === '—') {
    return null;
  }
  return trimmed;
}

async function findLeadContactById(leadId: string): Promise<{
  readonly contactName: string;
  readonly contactEmail: string | null;
  readonly contactCompany: string | null;
  readonly contactPhone: string | null;
}> {
  if (!process.env.MONGODB_URI) {
    return { contactName: 'Unknown client', contactEmail: null, contactCompany: null, contactPhone: null };
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(leadId);
  } catch {
    return { contactName: 'Unknown client', contactEmail: null, contactCompany: null, contactPhone: null };
  }
  const db = await getDb();
  const leadDoc = await db.collection<LeadDocument>(COLLECTIONS.leads).findOne({ _id: objectId });
  if (leadDoc === null) {
    return { contactName: 'Unknown client', contactEmail: null, contactCompany: null, contactPhone: null };
  }
  const name = formatLeadContactField(leadDoc.name) ?? 'Unknown client';
  return {
    contactName: name,
    contactEmail: formatLeadContactField(leadDoc.email),
    contactCompany: formatLeadContactField(leadDoc.company),
    contactPhone: formatLeadContactField(leadDoc.phone),
  };
}

async function findAccountEmailByVisitorId(visitorId: string): Promise<string | null> {
  const accountPrefix = 'acct:';
  if (!visitorId.startsWith(accountPrefix) || !process.env.MONGODB_URI) {
    return null;
  }
  const userIdHex = visitorId.slice(accountPrefix.length).trim();
  if (userIdHex.length === 0) {
    return null;
  }
  let objectId: ObjectId;
  try {
    objectId = new ObjectId(userIdHex);
  } catch {
    return null;
  }
  const db = await getDb();
  const userDoc = await db
    .collection<UserAccountDocument>(COLLECTIONS.users)
    .findOne({ _id: objectId }, { projection: { emailNormalized: 1 } });
  if (userDoc === null) {
    return null;
  }
  const email = userDoc.emailNormalized?.trim() ?? '';
  return email.length > 0 ? email : null;
}

function buildBookingDocumentForDisplayTitles(booking: BookingDetailRow): BookingDocument {
  return {
    serviceKey: booking.serviceKey,
    guidedDiagnosticSnapshot: booking.guidedDiagnosticSnapshot,
    diagnosticSessionId:
      booking.diagnosticSessionId !== null ? new ObjectId(booking.diagnosticSessionId) : null,
  } as BookingDocument;
}

/**
 * Loads human-friendly overview labels and client contact for admin booking detail.
 */
export async function resolveAdminBookingOverviewContext(
  booking: BookingDetailRow,
): Promise<AdminBookingOverviewContext> {
  const [displayTitles, serviceTitle, leadContact, accountEmail] = await Promise.all([
    resolveBookingSessionDisplayTitles(buildBookingDocumentForDisplayTitles(booking)),
    resolveCheckoutServiceTitle(booking.serviceKey),
    findLeadContactById(booking.leadId),
    findAccountEmailByVisitorId(booking.visitorId),
  ]);
  return {
    bookingReference: formatBookingReferenceId(booking.id),
    serviceTitle,
    sessionTitlePreview: displayTitles.sessionTitle,
    ...leadContact,
    isGuestBooking: !booking.visitorId.startsWith('acct:'),
    accountEmail,
  };
}
