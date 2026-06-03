'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  PAYMENT_CHECKOUT_PREP_DEBOUNCE_MS,
  type PaymentCheckoutPrepCacheEntry,
  clearPaymentCheckoutPrep,
  readPaymentCheckoutPrep,
  writePaymentCheckoutPrep,
} from '@/lib/marketing/payment-checkout-prep-cache';

export function usePaymentCheckoutPrepare(input: {
  readonly scope: string;
  readonly enabled: boolean;
  readonly prepKey: string | null;
  readonly prepare: (signal: AbortSignal) => Promise<{ readonly redirectUrl: string; readonly transactionId: string } | null>;
  readonly debounceMs?: number;
}): {
  readonly isPreparing: boolean;
  readonly preparedEntry: PaymentCheckoutPrepCacheEntry | null;
  readonly invalidatePrep: () => void;
} {
  const { scope, enabled, prepKey, prepare, debounceMs: inputDebounceMs } = input;
  const debounceMs = inputDebounceMs ?? PAYMENT_CHECKOUT_PREP_DEBOUNCE_MS;
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparedEntry, setPreparedEntry] = useState<PaymentCheckoutPrepCacheEntry | null>(null);
  const prepareGenerationRef = useRef(0);
  const shouldPrepare = enabled && prepKey !== null && prepKey.length > 0;
  const cachedEntry = shouldPrepare && prepKey !== null ? readPaymentCheckoutPrep(scope) : null;
  const cachedPreparedEntry = cachedEntry !== null && cachedEntry.prepKey === prepKey ? cachedEntry : null;
  const asyncPreparedEntry = preparedEntry !== null && preparedEntry.prepKey === prepKey ? preparedEntry : null;
  const effectivePreparedEntry = shouldPrepare ? (asyncPreparedEntry ?? cachedPreparedEntry) : null;
  const effectiveIsPreparing = shouldPrepare && isPreparing;
  const invalidatePrep = useCallback((): void => {
    clearPaymentCheckoutPrep(scope);
    setPreparedEntry(null);
    prepareGenerationRef.current += 1;
  }, [scope]);
  useEffect(() => {
    if (!shouldPrepare || prepKey === null) {
      return;
    }
    if (cachedPreparedEntry !== null) {
      return;
    }
    const generation = prepareGenerationRef.current + 1;
    prepareGenerationRef.current = generation;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setIsPreparing(true);
      void prepare(controller.signal)
        .then((result) => {
          if (prepareGenerationRef.current !== generation || controller.signal.aborted) {
            return;
          }
          if (result === null || result.redirectUrl.length === 0) {
            setPreparedEntry(null);
            return;
          }
          const entry: PaymentCheckoutPrepCacheEntry = {
            prepKey,
            transactionId: result.transactionId,
            redirectUrl: result.redirectUrl,
            preparedAt: Date.now(),
          };
          writePaymentCheckoutPrep(scope, entry);
          setPreparedEntry(entry);
        })
        .catch(() => {
          if (prepareGenerationRef.current === generation) {
            setPreparedEntry(null);
          }
        })
        .finally(() => {
          if (prepareGenerationRef.current === generation) {
            setIsPreparing(false);
          }
        });
    }, debounceMs);
    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [cachedPreparedEntry, debounceMs, prepKey, prepare, scope, shouldPrepare]);
  return { isPreparing: effectiveIsPreparing, preparedEntry: effectivePreparedEntry, invalidatePrep };
}
