import { DEFAULT_BOOKING_SERVICE_KEY } from '@/store/marketing';
import { PRIMARY_TIMEZONE } from '@/lib/timezone';

const DEFAULT_SERVICE_KEY = DEFAULT_BOOKING_SERVICE_KEY;

export type LinkedBookingSlotSnapshot = {
  readonly bookingId: string;
  readonly status: 'pending' | 'confirmed' | 'cancelled';
  readonly startsAtIso: string;
  readonly timezone: string;
  readonly serviceKey: string;
  readonly meetingUrl: string | null;
  readonly paymentTransactionId: string | null;
  readonly paymentMethodLabel: string | null;
  readonly paymentStatus: string | null;
  readonly customerName: string | null;
  readonly customerEmail: string | null;
  readonly customerCompany: string | null;
  readonly customerPhone: string | null;
};

export function isLinkedBookingPendingPayment(linked: LinkedBookingSlotSnapshot): boolean {
  return linked.status === 'pending' && linked.paymentStatus !== 'paid';
}

export function isLinkedBookingCancelled(linked: LinkedBookingSlotSnapshot): boolean {
  return linked.status === 'cancelled';
}

export function parseLinkedBookingSlotSnapshot(value: unknown): LinkedBookingSlotSnapshot | null {
  if (value === null || value === undefined || typeof value !== 'object') {
    return null;
  }
  const row = value as Record<string, unknown>;
  const bookingId = typeof row.bookingId === 'string' ? row.bookingId.trim() : '';
  const startsAtIso = typeof row.startsAtIso === 'string' ? row.startsAtIso.trim() : '';
  if (bookingId.length === 0 || startsAtIso.length === 0) {
    return null;
  }
  const statusRaw = row.status;
  const status =
    statusRaw === 'pending' || statusRaw === 'confirmed' || statusRaw === 'cancelled' ? statusRaw : 'confirmed';
  const timezone =
    typeof row.timezone === 'string' && row.timezone.trim().length > 0 ? row.timezone.trim() : PRIMARY_TIMEZONE;
  const serviceKey =
    typeof row.serviceKey === 'string' && row.serviceKey.trim().length > 0
      ? row.serviceKey.trim()
      : DEFAULT_SERVICE_KEY;
  const meetingRaw = typeof row.meetingUrl === 'string' ? row.meetingUrl.trim() : '';
  const paymentTransactionId =
    typeof row.paymentTransactionId === 'string' && row.paymentTransactionId.trim().length > 0
      ? row.paymentTransactionId.trim()
      : null;
  const paymentMethodRaw = typeof row.paymentMethodLabel === 'string' ? row.paymentMethodLabel.trim() : '';
  const customerNameRaw = typeof row.customerName === 'string' ? row.customerName.trim() : '';
  const customerEmailRaw = typeof row.customerEmail === 'string' ? row.customerEmail.trim() : '';
  const customerCompanyRaw = typeof row.customerCompany === 'string' ? row.customerCompany.trim() : '';
  const customerPhoneRaw = typeof row.customerPhone === 'string' ? row.customerPhone.trim() : '';
  return {
    bookingId,
    status,
    startsAtIso,
    timezone,
    serviceKey,
    meetingUrl: meetingRaw.length > 0 ? meetingRaw : null,
    paymentTransactionId,
    paymentMethodLabel: paymentMethodRaw.length > 0 ? paymentMethodRaw : null,
    paymentStatus: typeof row.paymentStatus === 'string' ? row.paymentStatus : null,
    customerName: customerNameRaw.length > 0 ? customerNameRaw : null,
    customerEmail: customerEmailRaw.length > 0 ? customerEmailRaw : null,
    customerCompany: customerCompanyRaw.length > 0 ? customerCompanyRaw : null,
    customerPhone: customerPhoneRaw.length > 0 ? customerPhoneRaw : null,
  };
}

export function resolveDiagnosticShowBookingActions(params: {
  readonly sessionReadOnly: boolean;
  readonly linkedBookingSlot: LinkedBookingSlotSnapshot | null;
}): boolean {
  if (!params.sessionReadOnly) {
    return true;
  }
  if (params.linkedBookingSlot === null) {
    return false;
  }
  if (isLinkedBookingCancelled(params.linkedBookingSlot)) {
    return false;
  }
  return isLinkedBookingPendingPayment(params.linkedBookingSlot);
}
