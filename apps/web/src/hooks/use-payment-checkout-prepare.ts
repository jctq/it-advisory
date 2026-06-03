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
  const debounceMs = input.debounceMs ?? PAYMENT_CHECKOUT_PREP_DEBOUNCE_MS;
  const [isPreparing, setIsPreparing] = useState(false);
  const [preparedEntry, setPreparedEntry] = useState<PaymentCheckoutPrepCacheEntry | null>(null);
  const prepareGenerationRef = useRef(0);
  const invalidatePrep = useCallback((): void => {
    clearPaymentCheckoutPrep(input.scope);
    setPreparedEntry(null);
    prepareGenerationRef.current += 1;
  }, [input.scope]);
  useEffect(() => {
    if (!input.enabled || input.prepKey === null || input.prepKey.length === 0) {
      setPreparedEntry(null);
      return;
    }
    const cached = readPaymentCheckoutPrep(input.scope);
    if (cached !== null && cached.prepKey === input.prepKey) {
      setPreparedEntry(cached);
      return;
    }
    const generation = prepareGenerationRef.current + 1;
    prepareGenerationRef.current = generation;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      setIsPreparing(true);
      void input
        .prepare(controller.signal)
        .then((result) => {
          if (prepareGenerationRef.current !== generation || controller.signal.aborted) {
            return;
          }
          if (result === null || result.redirectUrl.length === 0) {
            setPreparedEntry(null);
            return;
          }
          const entry: PaymentCheckoutPrepCacheEntry = {
            prepKey: input.prepKey!,
            transactionId: result.transactionId,
            redirectUrl: result.redirectUrl,
            preparedAt: Date.now(),
          };
          writePaymentCheckoutPrep(input.scope, entry);
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
  }, [debounceMs, input.enabled, input.prepKey, input.prepare, input.scope]);
  return { isPreparing, preparedEntry, invalidatePrep };
}
