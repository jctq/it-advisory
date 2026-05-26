import type { CatalogServiceKind } from '@/domain/monetization-types';
import { getResolvedSiteName } from '@/lib/data/app-settings';
import { formatBookingConfirmationSubject } from '@/lib/data/email-settings';
import type { PaymentTransactionRow } from '@/lib/data/payment-transactions';
import { resolveAbsoluteSiteOrigin } from '@/lib/email/email-brand';
import {
  buildBookingCatalogSectionHtml,
  buildBookingConfirmationEmailHtml,
  buildBookingPaymentSectionHtml,
} from '@/lib/email/send-booking-confirmation-email';
import { buildBookingFathomNotesEmailHtml } from '@/lib/email/send-booking-fathom-notes-email';
import { readManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';
import {
  BOOKING_SESSION_CALENDAR_DURATION_MINUTES,
  buildBookingCalendarLinkBundle,
} from '@techmd/domain/booking-calendar-links';

const SAMPLE_BOOKING_REFERENCE = 'TMD-7K2M9P' as const;

export type TransactionalEmailTemplatePreview = {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly subject: string;
  readonly html: string;
};

export type BuildTransactionalEmailTemplatePreviewsInput = {
  readonly bookingConfirmationSubject?: string;
};

function buildSamplePaymentTransaction(): PaymentTransactionRow {
  return {
    id: 'preview-payment',
    gatewayId: 'paymongo',
    providerRef: 'pi_preview_abc123xyz',
    providerSessionId: 'cs_preview',
    status: 'paid',
    paymentPolicy: 'pay_before_booking',
    amountCentavos: 250000,
    currency: 'PHP',
    visitorId: 'preview-visitor',
    bookingId: 'preview-booking',
    bookingDraftId: 'preview-draft',
    serviceKey: 'strategy-session',
    timezone: 'Asia/Manila',
    leadId: 'preview-lead',
    customerName: 'Alex Rivera',
    customerEmail: 'alex@example.com',
    customerCompany: 'Acme Corp',
    customerPhone: '+639171234567',
    quizSessionIdHex: null,
    redirectUrl: null,
    paymentMethodLabel: 'GCash',
    startsAtIso: '2026-06-15T02:00:00.000Z',
    expiresAtIso: null,
    paidAtIso: '2026-06-10T08:30:00.000Z',
  };
}

export async function buildTransactionalEmailTemplatePreviews(
  input: BuildTransactionalEmailTemplatePreviewsInput = {},
): Promise<readonly TransactionalEmailTemplatePreview[]> {
  const brandName = await getResolvedSiteName();
  const siteOrigin = resolveAbsoluteSiteOrigin();
  const manageBookingEnabled = await readManageBookingEnabled();
  const manageUrl = manageBookingEnabled && siteOrigin.length > 0 ? `${siteOrigin}/book/manage` : '';
  const meetingUrl =
    siteOrigin.length > 0 ? `${siteOrigin}/meet/preview-strategy-session` : 'https://meet.google.com/abc-defg-hij';
  const sampleStartsAt = new Date('2026-06-15T02:00:00.000Z');
  const dateLong = 'Monday, June 15, 2026';
  const timeLabel = '10:00 AM';
  const serviceTitle = 'Strategy session';
  const calendarBundle = buildBookingCalendarLinkBundle({
    title: `${serviceTitle} — ${SAMPLE_BOOKING_REFERENCE}`,
    description: `Booking reference ${SAMPLE_BOOKING_REFERENCE}. ${manageUrl.length > 0 ? `Manage: ${manageUrl}` : `Manage on ${brandName}.`}`,
    location: meetingUrl,
    startsAtUtc: sampleStartsAt,
    durationMinutes: BOOKING_SESSION_CALENDAR_DURATION_MINUTES,
    icsUidSeed: SAMPLE_BOOKING_REFERENCE,
  });
  const catalogKind: CatalogServiceKind = 'session';
  const catalogSectionHtml = buildBookingCatalogSectionHtml({
    title: serviceTitle,
    description: 'A focused consultation to review your technology roadmap and next steps.',
    durationLabel: '60 minutes',
    amountLabel: '₱2,500.00',
    kind: catalogKind,
    sessionsIncluded: null,
  });
  const paymentSectionHtml = buildBookingPaymentSectionHtml(buildSamplePaymentTransaction());
  const bookingConfirmationSubject = formatBookingConfirmationSubject(
    SAMPLE_BOOKING_REFERENCE,
    input.bookingConfirmationSubject ?? '',
  );
  const bookingConfirmationHtml = buildBookingConfirmationEmailHtml({
    brandName,
    customerName: 'Alex',
    bookingReference: SAMPLE_BOOKING_REFERENCE,
    serviceLabel: serviceTitle,
    dateLong,
    timeLabel,
    manageUrl,
    meetingUrl,
    includeRecordingDisclosure: true,
    siteOrigin,
    calendarBundle,
    catalogSectionHtml,
    paymentSectionHtml,
  });
  const fathomNotesHtml = buildBookingFathomNotesEmailHtml({
    brandName,
    siteOrigin,
    attendeeDisplayName: 'Alex',
    bookingReference: SAMPLE_BOOKING_REFERENCE,
    dateLong,
    timeLabel,
    shareUrl: siteOrigin.length > 0 ? `${siteOrigin}/notes/preview` : 'https://fathom.video/share/preview',
    summary:
      'We reviewed your current infrastructure, identified quick wins for observability, and agreed on a phased migration plan for the customer portal.',
    actionItems: [
      'Share the latest architecture diagram before Friday',
      'Schedule a follow-up session to review the migration timeline',
    ],
  });
  return [
    {
      id: 'booking_payment_confirmed',
      label: 'Booking confirmation',
      description: 'Sent after payment succeeds and a booking is confirmed.',
      subject: bookingConfirmationSubject,
      html: bookingConfirmationHtml,
    },
    {
      id: 'booking_fathom_notes',
      label: 'Meeting notes (Fathom)',
      description: 'Sent when Fathom notes are ready and the customer opted into recording.',
      subject: `Meeting notes — ${SAMPLE_BOOKING_REFERENCE}`,
      html: fathomNotesHtml,
    },
  ];
}
