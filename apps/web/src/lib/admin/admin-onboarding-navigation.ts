import type { AdminOnboardingTourTarget } from '@/lib/admin/admin-onboarding';

function buildAdminTourSelector(target: AdminOnboardingTourTarget): string {
  return `[data-admin-tour="${target}"]`;
}

const ROUTE_WAIT_INTERVAL_MS = 80;
const ROUTE_WAIT_TIMEOUT_MS = 12000;

export function matchesAdminRoute(pathname: string, routePath: string): boolean {
  if (routePath === '/admin') {
    return pathname === '/admin';
  }
  return pathname === routePath || pathname.startsWith(`${routePath}/`);
}

export function waitForAdminTourElement(
  target: AdminOnboardingTourTarget,
  timeoutMs: number = ROUTE_WAIT_TIMEOUT_MS,
): Promise<Element | null> {
  const selector = buildAdminTourSelector(target);
  const startedAt = Date.now();
  return new Promise((resolve) => {
    const executePoll = (): void => {
      const element = document.querySelector(selector);
      if (element !== null) {
        resolve(element);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(null);
        return;
      }
      window.setTimeout(executePoll, ROUTE_WAIT_INTERVAL_MS);
    };
    executePoll();
  });
}
