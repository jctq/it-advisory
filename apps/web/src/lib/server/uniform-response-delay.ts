const GUEST_LOOKUP_DELAY_MS = 120 as const;

/**
 * Adds a small fixed delay so credential lookup timing does not leak validity.
 */
export async function executeUniformGuestLookupDelay(): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, GUEST_LOOKUP_DELAY_MS);
  });
}
