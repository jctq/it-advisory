import { describe, expect, it } from 'vitest';
import {
  isSessionAwaitingPayment,
  isSessionPaymentExpiredForManage,
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
  it('treats expired payment as view/manage only', () => {
    const row = buildRow({});
    expect(isSessionPaymentExpiredForManage(row)).toBe(true);
    expect(isSessionAwaitingPayment(row)).toBe(false);
  });

  it('still treats open checkout as awaiting payment', () => {
    const row = buildRow({ paymentTransactionStatus: 'pending' });
    expect(isSessionAwaitingPayment(row)).toBe(true);
    expect(isSessionPaymentExpiredForManage(row)).toBe(false);
  });
});
