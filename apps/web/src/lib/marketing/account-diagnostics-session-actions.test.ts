import { describe, expect, it } from 'vitest';
import {
  isSessionAwaitingPayment,
  isSessionPaymentExpiredForManage,
  resolveAccountDiagnosticsCanDeleteSession,
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
    bookingPaymentStatus: null,
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

const manualConfirmOptions = { paymentPolicy: 'manual_confirm' as const, refundsEnabled: false };
const reserveThenPayOptions = { paymentPolicy: 'pay_after_hold' as const, refundsEnabled: true };

describe('account diagnostics session actions', () => {
  it('treats expired payment as manage-only for pending complete diagnostics', () => {
    const row = buildRow({});
    expect(isSessionPaymentExpiredForManage(row)).toBe(true);
    expect(isSessionAwaitingPayment(row)).toBe(false);
    expect(resolveAccountDiagnosticsSessionActions(row, reserveThenPayOptions)).toEqual(['manage', 'delete']);
  });

  it('shows manage only while checkout is open', () => {
    const row = buildRow({ paymentTransactionStatus: 'pending' });
    expect(isSessionAwaitingPayment(row)).toBe(true);
    expect(isSessionPaymentExpiredForManage(row)).toBe(false);
    expect(resolveAccountDiagnosticsSessionActions(row, reserveThenPayOptions)).toEqual(['manage']);
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
    expect(resolveAccountDiagnosticsSessionActions(row, reserveThenPayOptions)).toEqual(['continue', 'delete']);
    expect(resolveAccountDiagnosticsCanDeleteSession(row)).toBe(true);
  });

  it('hides delete while checkout payment is open', () => {
    const row = buildRow({ paymentTransactionStatus: 'pending' });
    expect(resolveAccountDiagnosticsCanDeleteSession(row)).toBe(false);
  });

  it('shows cancel for manual-confirm confirmed bookings without payment', () => {
    const row = buildRow({ bookingStatus: 'confirmed', paymentTransactionStatus: null });
    expect(resolveAccountDiagnosticsSessionActions(row, manualConfirmOptions)).toEqual(['view', 'cancel']);
  });

  it('shows refund for paid manual-confirm confirmed bookings when refunds enabled', () => {
    const row = buildRow({
      bookingStatus: 'confirmed',
      bookingPaymentStatus: 'paid',
      paymentTransactionStatus: null,
    });
    expect(
      resolveAccountDiagnosticsSessionActions(row, {
        paymentPolicy: 'manual_confirm',
        refundsEnabled: true,
      }),
    ).toEqual(['view', 'refund']);
  });

  it('shows refund for paid reserve-then-pay confirmed bookings when refunds enabled', () => {
    const row = buildRow({ bookingStatus: 'confirmed', paymentTransactionStatus: 'paid' });
    expect(resolveAccountDiagnosticsSessionActions(row, reserveThenPayOptions)).toEqual(['view', 'refund']);
  });

  it('shows view only for completed bookings', () => {
    const row = buildRow({ bookingStatus: 'completed', paymentTransactionStatus: 'paid' });
    expect(resolveAccountDiagnosticsSessionActions(row, reserveThenPayOptions)).toEqual(['view']);
  });

  it('shows refund for paid pending bookings awaiting confirmation when refunds enabled', () => {
    const row = buildRow({ bookingStatus: 'pending', paymentTransactionStatus: 'paid' });
    expect(resolveAccountDiagnosticsSessionActions(row, reserveThenPayOptions)).toEqual(['view', 'refund']);
  });

  it('hides refund when admin refunds setting is off', () => {
    const row = buildRow({ bookingStatus: 'confirmed', paymentTransactionStatus: 'paid' });
    expect(
      resolveAccountDiagnosticsSessionActions(row, {
        paymentPolicy: 'pay_after_hold',
        refundsEnabled: false,
      }),
    ).toEqual(['view']);
  });

  it('shows view only for refund awaiting bookings', () => {
    const row = buildRow({ bookingStatus: 'refund_awaiting', paymentTransactionStatus: 'paid' });
    expect(resolveAccountDiagnosticsSessionActions(row, reserveThenPayOptions)).toEqual(['view']);
  });

  it('shows view for cancelled bookings', () => {
    const row = buildRow({ bookingStatus: 'cancelled', paymentTransactionStatus: null });
    expect(resolveAccountDiagnosticsSessionActions(row, reserveThenPayOptions)).toEqual(['view']);
  });
});
