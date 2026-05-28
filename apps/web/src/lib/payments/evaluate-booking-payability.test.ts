import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import type { BookingDocument, LeadDocument } from '@/domain/types';
import { evaluateBookingPayability } from './evaluate-booking-payability';

function buildBooking(overrides: Partial<BookingDocument> = {}): BookingDocument {
  return {
    leadId: new ObjectId(),
    visitorId: 'acct:674a1b2c3d4e5f6789012340',
    serviceKey: 'project-rescue',
    startsAt: new Date('2026-05-13T07:00:00.000Z'),
    timezone: 'Asia/Manila',
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function buildLead(overrides: Partial<LeadDocument> = {}): LeadDocument {
  return {
    visitorId: 'acct:674a1b2c3d4e5f6789012340',
    name: 'Test User',
    email: 'test@example.com',
    phone: '+639171234567',
    company: '',
    source: 'test',
    createdAt: new Date(),
    ...overrides,
  };
}

describe('evaluateBookingPayability', () => {
  it('returns ok for pending booking with email and payments enabled', () => {
    const result = evaluateBookingPayability({
      bookingId: '674a1b2c3d4e5f6789012345',
      booking: buildBooking({ startsAt: new Date('2099-06-01T07:00:00.000Z') }),
      lead: buildLead(),
      paymentPolicy: 'pay_before_booking',
      paymentsEnabled: true,
    });
    expect(result.code).toBe('ok');
    expect(result.canPayOnline).toBe(true);
  });

  it('blocks when lead email is missing', () => {
    const result = evaluateBookingPayability({
      bookingId: '674a1b2c3d4e5f6789012345',
      booking: buildBooking(),
      lead: buildLead({ email: '' }),
      paymentPolicy: 'pay_before_booking',
      paymentsEnabled: true,
    });
    expect(result.code).toBe('lead_email_missing');
    expect(result.canPayOnline).toBe(false);
  });

  it('blocks when payment window expired', () => {
    const result = evaluateBookingPayability({
      bookingId: '674a1b2c3d4e5f6789012345',
      booking: buildBooking({ paymentExpiresAt: new Date('2020-01-01T00:00:00.000Z') }),
      lead: buildLead(),
      paymentPolicy: 'pay_after_hold',
      paymentsEnabled: true,
    });
    expect(result.code).toBe('payment_window_expired');
    expect(result.canPayOnline).toBe(false);
  });

  it('blocks when session slot is in the past and unpaid', () => {
    const result = evaluateBookingPayability({
      bookingId: '674a1b2c3d4e5f6789012345',
      booking: buildBooking({ startsAt: new Date('2020-01-01T00:00:00.000Z') }),
      lead: buildLead(),
      paymentPolicy: 'pay_before_booking',
      paymentsEnabled: true,
    });
    expect(result.code).toBe('session_slot_in_past');
    expect(result.canPayOnline).toBe(false);
  });

  it('blocks when visitor id does not match', () => {
    const result = evaluateBookingPayability({
      bookingId: '674a1b2c3d4e5f6789012345',
      booking: buildBooking({ visitorId: 'acct:other' }),
      lead: buildLead(),
      paymentPolicy: 'pay_before_booking',
      paymentsEnabled: true,
      expectedVisitorId: 'acct:expected',
    });
    expect(result.code).toBe('visitor_mismatch');
    expect(result.canPayOnline).toBe(false);
  });
});
