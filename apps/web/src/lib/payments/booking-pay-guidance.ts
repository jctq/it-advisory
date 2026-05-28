import type { BookingDocument } from '@/domain/types';
import type { BookingPayabilityCode } from '@/lib/payments/evaluate-booking-payability';

export type BookingPayGuidanceAction = {
  readonly label: string;
  readonly href: string;
};

export type BookingPayGuidance = {
  readonly title: string;
  readonly message: string;
  readonly steps: readonly string[];
  readonly actions: readonly BookingPayGuidanceAction[];
};

export type BuildBookingPayGuidanceInput = {
  readonly payabilityCode: BookingPayabilityCode;
  readonly blockedReason: string | null;
  readonly canPayOnline: boolean;
  readonly status: BookingDocument['status'];
  readonly manageKind: 'account' | 'guest';
  readonly profileSyncAvailable?: boolean;
};

/**
 * User-facing steps when manage booking cannot proceed to online payment.
 */
export function buildBookingPayGuidance(input: BuildBookingPayGuidanceInput): BookingPayGuidance | null {
  if (input.canPayOnline) {
    return null;
  }
  if (input.status === 'confirmed' || input.status === 'completed' || input.status === 'cancelled') {
    return null;
  }
  const fallbackMessage =
    input.blockedReason ?? 'Online payment is not available for this booking right now.';
  if (input.payabilityCode === 'manual_confirm_policy') {
    return {
      title: 'Awaiting confirmation',
      message: fallbackMessage,
      steps: [
        'We review bookings manually before confirming.',
        'Watch your inbox (and spam folder) for a confirmation email from us.',
        'Once confirmed, you will receive meeting details by email.',
      ],
      actions: [{ label: 'Back to home', href: '/' }],
    };
  }
  if (input.payabilityCode === 'session_slot_in_past') {
    return {
      title: 'Consultation time has passed',
      message: fallbackMessage,
      steps: [
        'Your original slot is in the past and this booking is still unpaid.',
        'Pick a new date and time below, then complete payment.',
        'Or delete the diagnostic to cancel this booking and start fresh later.',
      ],
      actions: [],
    };
  }
  if (input.payabilityCode === 'payment_window_expired') {
    return {
      title: 'Payment window closed',
      message: fallbackMessage,
      steps: [
        'The time limit to pay for this slot has passed.',
        'Book a new consultation to pick a fresh time.',
        'If you already paid or believe this is a mistake, contact us with your booking reference.',
      ],
      actions: [{ label: 'Book a new consultation', href: '/book' }],
    };
  }
  if (input.payabilityCode === 'payments_disabled') {
    return {
      title: 'Online payment unavailable',
      message: fallbackMessage,
      steps: [
        'Card and wallet checkout is turned off temporarily.',
        'We can still help you complete this booking—reach out with your booking reference.',
      ],
      actions: [],
    };
  }
  if (input.payabilityCode === 'lead_email_missing') {
    if (input.manageKind === 'account' && input.profileSyncAvailable === true) {
      return {
        title: 'Booking contact out of sync',
        message:
          'Your account has an email, but this booking’s contact record was created before your profile was complete.',
        steps: [
          'Use “Sync profile to booking” to copy your name, email, phone, and company from your account onto this booking.',
          'Then choose a payment method and complete checkout.',
        ],
        actions: [{ label: 'Account profile', href: '/account/profile' }],
      };
    }
    if (input.manageKind === 'account') {
      return {
        title: 'Complete your account profile',
        message:
          'We need a valid email (and phone) on your account before you can pay for this booking online.',
        steps: [
          'Open your account profile and add or correct your email and Philippine mobile number.',
          'Save your profile, then return here and sync profile to booking if needed.',
          'Select your payment method and complete checkout.',
        ],
        actions: [
          { label: 'Update profile', href: '/account/profile' },
          { label: 'My diagnostics', href: '/account/diagnostics' },
        ],
      };
    }
    return {
      title: 'Contact details need updating',
      message: fallbackMessage,
      steps: [
        'This booking is missing a contact email in our system.',
        'Email us your booking reference and the email you used when booking so we can fix your record.',
        'After we update your details, return here to complete payment.',
      ],
      actions: [],
    };
  }
  if (input.payabilityCode === 'lead_not_found') {
    return {
      title: 'Booking contact record missing',
      message: fallbackMessage,
      steps: [
        'Your booking exists but is not linked to complete contact details.',
        'Contact us with your booking reference and the email you used when booking.',
        'We will repair the record so you can pay online.',
      ],
      actions: [],
    };
  }
  if (input.payabilityCode === 'visitor_mismatch') {
    if (input.manageKind === 'account') {
      return {
        title: 'Sign in with the correct account',
        message:
          'This booking belongs to a different signed-in session than the one you are using now.',
        steps: [
          'Sign out, then sign in with the email you used when you booked.',
          'Make sure your profile has the same email and phone as on the booking.',
          'Open manage booking again from your confirmation email or account diagnostics.',
        ],
        actions: [
          { label: 'Account profile', href: '/account/profile' },
          { label: 'My diagnostics', href: '/account/diagnostics' },
          { label: 'Sign in', href: '/login?next=%2Fbook%2Fmanage' },
        ],
      };
    }
    return {
      title: 'Use guest lookup instead',
      message: fallbackMessage,
      steps: [
        'Look up this booking with your booking reference, email, and phone last four digits below.',
        'If details do not match, use the same email and phone you entered when booking.',
      ],
      actions: [{ label: 'Look up as guest', href: '/book/manage' }],
    };
  }
  if (input.payabilityCode === 'status_not_pending') {
    return {
      title: 'Cannot pay online',
      message: fallbackMessage,
      steps: ['This booking is not waiting for payment.', 'Contact us if you need help with this reservation.'],
      actions: [],
    };
  }
  return {
    title: 'Next steps',
    message: fallbackMessage,
    steps: ['Review the message above.', 'Contact us if you need help completing this booking.'],
    actions: [],
  };
}

export function buildPaymentGatewaysUnavailableGuidance(): BookingPayGuidance {
  return {
    title: 'Payment methods temporarily unavailable',
    message: 'Your booking is ready to pay, but checkout is not configured right now.',
    steps: [
      'Try again in a few minutes.',
      'If this continues, contact us with your booking reference and we will help you pay.',
    ],
    actions: [],
  };
}
