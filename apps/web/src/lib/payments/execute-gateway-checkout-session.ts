import type {
  CreateCheckoutSessionInput,
  CreateCheckoutSessionResult,
  PaymentGatewayAdapter,
} from '@teqmd/payments';
import type { CheckoutTimingCollector } from '@/lib/payments/checkout-timing';

const GATEWAY_TIMEOUT_MS = 12_000 as const;
const GATEWAY_MAX_ATTEMPTS = 2 as const;
const GATEWAY_RETRY_DELAY_MS = 400 as const;

function isRetryableGatewayError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return true;
  }
  const message = error.message.toLowerCase();
  if (message.includes('timeout') || message.includes('network') || message.includes('fetch failed')) {
    return true;
  }
  if (message.includes('http 5') || message.includes('502') || message.includes('503') || message.includes('504')) {
    return true;
  }
  return false;
}

async function executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('Payment provider timed out. Please try again.'));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function executeGatewayCheckoutSession(input: {
  readonly adapter: PaymentGatewayAdapter;
  readonly sessionInput: CreateCheckoutSessionInput;
  readonly timing?: CheckoutTimingCollector;
}): Promise<CreateCheckoutSessionResult> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= GATEWAY_MAX_ATTEMPTS; attempt += 1) {
    try {
      input.timing?.mark(attempt === 1 ? 'gateway_create' : 'gateway_create_retry');
      const result = await executeWithTimeout(
        input.adapter.createCheckoutSession(input.sessionInput),
        GATEWAY_TIMEOUT_MS,
      );
      return result;
    } catch (error: unknown) {
      lastError = error;
      if (attempt >= GATEWAY_MAX_ATTEMPTS || !isRetryableGatewayError(error)) {
        break;
      }
      await delay(GATEWAY_RETRY_DELAY_MS);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Payment provider error.');
}
