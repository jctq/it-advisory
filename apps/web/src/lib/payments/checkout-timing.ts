/**
 * Structured timing for payment checkout API routes (Railway logs).
 */
export type CheckoutTimingCollector = {
  mark: (segment: string) => void;
  logAndFinish: () => void;
};

export function createCheckoutTiming(flow: string): CheckoutTimingCollector {
  const startedAt = Date.now();
  let lastMarkAt = startedAt;
  const segments: Record<string, number> = {};
  return {
    mark(segment: string): void {
      const now = Date.now();
      segments[segment] = now - lastMarkAt;
      lastMarkAt = now;
    },
    logAndFinish(): void {
      const totalMs = Date.now() - startedAt;
      const parts = Object.entries(segments)
        .map(([key, ms]) => `${key}_ms=${ms}`)
        .join(' ');
      console.info(`[checkout_timing] flow=${flow} total_ms=${totalMs}${parts.length > 0 ? ` ${parts}` : ''}`);
    },
  };
}
