/**
 * Next.js instrumentation hook — validates production secrets before serving traffic.
 */
export async function register(): Promise<void> {
  const { assertProductionSecurityEnv } = await import('@/lib/server/production-security-env');
  assertProductionSecurityEnv();
}
