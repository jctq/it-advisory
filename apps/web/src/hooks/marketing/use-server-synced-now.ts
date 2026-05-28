'use client';

import { useEffect, useState } from 'react';
import { resolveServerSyncedNowMs } from '@/lib/marketing/payment-hold-expiry';

/**
 * Ticks using server-aligned time (`Date.now() + serverClockOffsetMs`), not the device clock alone.
 */
export function useServerSyncedNow(serverClockOffsetMs: number | null, tickIntervalMs: number = 1000): number | null {
  const [serverNowMs, setServerNowMs] = useState<number | null>(() =>
    resolveServerSyncedNowMs(serverClockOffsetMs),
  );
  useEffect(() => {
    if (serverClockOffsetMs === null) {
      queueMicrotask(() => {
        setServerNowMs(null);
      });
      return;
    }
    const tick = (): void => {
      setServerNowMs(resolveServerSyncedNowMs(serverClockOffsetMs));
    };
    tick();
    const intervalId = window.setInterval(tick, tickIntervalMs);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [serverClockOffsetMs, tickIntervalMs]);
  return serverNowMs;
}
