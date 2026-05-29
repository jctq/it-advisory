'use client';

import { useEffect, useRef, useState } from 'react';
import {
  createServerClockSyncAnchor,
  resolveServerSyncedNowMsFromAnchor,
  type ServerClockSyncAnchor,
} from '@/lib/marketing/server-clock-sync';

/**
 * Ticks using server-aligned time anchored at sync and advanced via `performance.now()`,
 * so countdowns are not affected if the device clock changes after load.
 */
export function useServerSyncedNow(serverClockOffsetMs: number | null, tickIntervalMs: number = 1000): number | null {
  const anchorRef = useRef<ServerClockSyncAnchor | null>(null);
  const [serverNowMs, setServerNowMs] = useState<number | null>(null);
  useEffect(() => {
    if (serverClockOffsetMs === null) {
      anchorRef.current = null;
      queueMicrotask(() => {
        setServerNowMs(null);
      });
      return;
    }
    anchorRef.current = createServerClockSyncAnchor(serverClockOffsetMs);
    const tick = (): void => {
      setServerNowMs(resolveServerSyncedNowMsFromAnchor(anchorRef.current));
    };
    tick();
    const intervalId = window.setInterval(tick, tickIntervalMs);
    return () => {
      window.clearInterval(intervalId);
    };
  }, [serverClockOffsetMs, tickIntervalMs]);
  return serverNowMs;
}
