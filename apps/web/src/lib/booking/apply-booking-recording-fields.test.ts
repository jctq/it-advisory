import { describe, expect, it } from 'vitest';
import { resolveCheckoutRecordingOptIn } from './apply-booking-recording-fields';

describe('resolveCheckoutRecordingOptIn', () => {
  it('honors an explicit opt-out from checkout UI', () => {
    expect(
      resolveCheckoutRecordingOptIn({
        requested: false,
        bookingRecordingOptIn: true,
        transactionMetadata: { recordingOptIn: 'true' },
      }),
    ).toBe(false);
  });

  it('uses booking snapshot when checkout did not send a choice', () => {
    expect(
      resolveCheckoutRecordingOptIn({
        bookingRecordingOptIn: true,
        transactionMetadata: { recordingOptIn: 'false' },
      }),
    ).toBe(true);
  });
});
