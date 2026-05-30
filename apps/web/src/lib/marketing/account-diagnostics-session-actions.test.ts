import { describe, expect, it } from 'vitest';
import {
  isSessionAwaitingPayment,
  isSessionPaymentExpiredForManage,
  resolveAccountDiagnosticsSessionActions,
} from './account-diagnostics-session-actions';
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
    paymentTransactionId: '507f1f77bcf86cd799439013',
    paymentTransactionStatus: 'expired',
    checkoutStartsAtIso: null,
    checkoutTimezone: null,
    checkoutServiceKey: null,
    ...overrides,
  };
}

describe('account diagnostics session actions', () => {
  it('treats expired payment as manage-only for pending complete diagnostics', () => {
    const row = buildRow({});
    expect(isSessionPaymentExpiredForManage(row)).toBe(true);
    expect(isSessionAwaitingPayment(row)).toBe(false);
    expect(resolveAccountDiagnosticsSessionActions(row)).toEqual(['manage']);
  });

  it('shows manage only while checkout is open', () => {
    const row = buildRow({ paymentTransactionStatus: 'pending' });
    expect(isSessionAwaitingPayment(row)).toBe(true);
    expect(isSessionPaymentExpiredForManage(row)).toBe(false);
    expect(resolveAccountDiagnosticsSessionActions(row)).toEqual(['manage']);
  });

  it('shows continue for pending incomplete diagnostics', () => {
    const row = buildRow({
      isDiagnosticComplete: false,
      isBooked: false,
      bookingId: null,
      bookingReferenceId: null,
      bookingStatus: null,
      paymentTransactionId: null,
      paymentTransactionStatus: null,
    });
    expect(resolveAccountDiagnosticsSessionActions(row)).toEqual(['continue']);
  });

  it('shows view for confirmed bookings', () => {
    const row = buildRow({ bookingStatus: 'confirmed', paymentTransactionStatus: 'paid' });
    expect(resolveAccountDiagnosticsSessionActions(row)).toEqual(['view']);
  });

  it('shows view for cancelled bookings', () => {
    const row = buildRow({ bookingStatus: 'cancelled', paymentTransactionStatus: null });
    expect(resolveAccountDiagnosticsSessionActions(row)).toEqual(['view']);
  });
});
