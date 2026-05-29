import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createServerClockSyncAnchor,
  resolveServerSyncedNowMsFromAnchor,
} from './server-clock-sync';

describe('server-clock-sync', () => {
  beforeEach(() => {
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    vi.spyOn(performance, 'now').mockReturnValue(500);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates an anchor from the server clock offset', () => {
    const anchor = createServerClockSyncAnchor(2_000);
    expect(anchor).toEqual({
      serverNowMsAtSync: 1_002_000,
      performanceNowAtSync: 500,
    });
  });

  it('advances server time using performance.now(), not Date.now()', () => {
    const anchor = createServerClockSyncAnchor(0);
    vi.mocked(performance.now).mockReturnValue(1_500);
    expect(resolveServerSyncedNowMsFromAnchor(anchor)).toBe(1_001_000);
    vi.mocked(Date.now).mockReturnValue(9_999_999);
    expect(resolveServerSyncedNowMsFromAnchor(anchor)).toBe(1_001_000);
  });

  it('returns null when anchor is null', () => {
    expect(resolveServerSyncedNowMsFromAnchor(null)).toBeNull();
  });
});
