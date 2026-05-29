export type ServerClockSyncAnchor = {
  readonly serverNowMsAtSync: number;
  readonly performanceNowAtSync: number;
};

/**
 * Captures server-aligned time at sync. Subsequent reads use `performance.now()` so
 * countdowns stay correct if the user changes the device clock after load.
 */
export function createServerClockSyncAnchor(serverClockOffsetMs: number): ServerClockSyncAnchor {
  return {
    serverNowMsAtSync: Date.now() + serverClockOffsetMs,
    performanceNowAtSync: performance.now(),
  };
}

export function resolveServerSyncedNowMsFromAnchor(anchor: ServerClockSyncAnchor | null): number | null {
  if (anchor === null) {
    return null;
  }
  const elapsedMs = performance.now() - anchor.performanceNowAtSync;
  return anchor.serverNowMsAtSync + elapsedMs;
}
