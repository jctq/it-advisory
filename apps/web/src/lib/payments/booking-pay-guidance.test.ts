import { describe, expect, it } from 'vitest';
import { buildBookingPayGuidance } from './booking-pay-guidance';

describe('buildBookingPayGuidance', () => {
  it('returns null when payment is allowed', () => {
    expect(
      buildBookingPayGuidance({
        payabilityCode: 'ok',
        blockedReason: null,
        canPayOnline: true,
        status: 'pending',
        manageKind: 'guest',
      }),
    ).toBeNull();
  });

  it('returns sync guidance when account profile can sync', () => {
    const guidance = buildBookingPayGuidance({
      payabilityCode: 'lead_email_missing',
      blockedReason: 'Missing email.',
      canPayOnline: false,
      status: 'pending',
      manageKind: 'account',
      profileSyncAvailable: true,
    });
    expect(guidance?.title).toContain('sync');
    expect(guidance?.steps.some((step) => step.includes('Sync profile'))).toBe(true);
  });

  it('returns sign-in guidance for account visitor_mismatch', () => {
    const guidance = buildBookingPayGuidance({
      payabilityCode: 'visitor_mismatch',
      blockedReason: 'Mismatch.',
      canPayOnline: false,
      status: 'pending',
      manageKind: 'account',
    });
    expect(guidance?.title).toContain('account');
    expect(guidance?.actions.some((action) => action.href.includes('/login'))).toBe(true);
  });
});
