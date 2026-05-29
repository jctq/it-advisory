import { describe, expect, it } from 'vitest';
import {
  resolveAccountDiagnosticsBookingStatusLabel,
  shouldShowAccountDiagnosticsScheduledSession,
} from './account-diagnostics-booking-status';
import type { VisitorQuizSessionSummary } from '../data/quiz-session-types';

function buildRow(
  overrides: Partial<VisitorQuizSessionSummary>,
): VisitorQuizSessionSummary {
  return {
    id: '507f1f77bcf86cd799439011',
    marketingSessionRef: 'ref',
    currentStep: 3,
    updatedAtIso: '2026-06-01T00:00:00.000Z',
    completedAtIso: null,
    isDiagnosticComplete: true,
    sessionTitlePreview: null,
    situationPreview: null,
    situationLabel: null,
    hasGuidedDiagnostic: true,
    isBooked: true,
    bookingId: '507f1f77bcf86cd799439012',
    bookingReferenceId: '439012',
    bookingStatus: 'pending',
    bookingStartsAtIso: '2026-06-01T02:00:00.000Z',
    bookingTimezone: 'Asia/Manila',
    bookingServiceKey: 'project-rescue',
    bookingMeetingUrl: null,
    paymentTransactionId: null,
    paymentTransactionStatus: null,
    checkoutStartsAtIso: null,
    checkoutTimezone: null,
    checkoutServiceKey: null,
    ...overrides,
  };
}

describe('resolveAccountDiagnosticsBookingStatusLabel', () => {
  it('returns completed when booking is completed', () => {
    expect(
      resolveAccountDiagnosticsBookingStatusLabel(
        buildRow({ bookingStatus: 'completed' }),
      ),
    ).toBe('completed');
  });

  it('returns awaiting_payment when checkout is open', () => {
    expect(
      resolveAccountDiagnosticsBookingStatusLabel(
        buildRow({ bookingStatus: 'pending', paymentTransactionStatus: 'pending' }),
      ),
    ).toBe('awaiting_payment');
  });

  it('returns confirmed when paid', () => {
    expect(
      resolveAccountDiagnosticsBookingStatusLabel(
        buildRow({ bookingStatus: 'pending', paymentTransactionStatus: 'paid' }),
      ),
    ).toBe('confirmed');
  });

  it('returns pending when unpaid without checkout', () => {
    expect(
      resolveAccountDiagnosticsBookingStatusLabel(
        buildRow({ bookingStatus: null, paymentTransactionStatus: null, isBooked: false }),
      ),
    ).toBe('pending');
  });
});

describe('shouldShowAccountDiagnosticsScheduledSession', () => {
  it('hides scheduled session when booking lifecycle is pending', () => {
    expect(
      shouldShowAccountDiagnosticsScheduledSession(
        buildRow({ bookingStatus: 'pending', paymentTransactionStatus: null }),
      ),
    ).toBe(false);
  });

  it('shows scheduled session when booking is confirmed', () => {
    expect(
      shouldShowAccountDiagnosticsScheduledSession(
        buildRow({ bookingStatus: 'confirmed' }),
      ),
    ).toBe(true);
  });
});
