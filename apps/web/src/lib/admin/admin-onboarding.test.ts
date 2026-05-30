import { describe, expect, it } from 'vitest';
import {
  ADMIN_ONBOARDING_STEP_DEFINITIONS,
  buildAdminOnboardingDriveSteps,
  shouldCloseMobileSidebarForOnboardingStep,
} from '@/lib/admin/admin-onboarding';
import { ADMIN_ONBOARDING_PAGE_STEP_DEFINITIONS } from '@/lib/admin/admin-onboarding-page-steps';

describe('admin onboarding', () => {
  it('includes page steps for support reports and debug', () => {
    const targets = ADMIN_ONBOARDING_PAGE_STEP_DEFINITIONS.map((step) => step.target);
    expect(targets).toContain('page-bookings-view-toggle');
    expect(targets).toContain('page-bookings-table');
    expect(targets).toContain('page-bookings-calendar');
    expect(targets).toContain('page-settings-general');
    expect(targets).toContain('page-settings-seo');
    expect(targets).toContain('page-settings-recordings');
    expect(targets).toContain('page-support-reports-table');
    expect(targets).toContain('page-schedule-tabs');
    expect(targets).toContain('page-schedule-preview');
    expect(targets).toContain('page-debug-tabs');
    expect(targets).toContain('page-debug-client-diagnostic');
    expect(targets).toContain('page-debug-cron-logs');
    expect(targets).toContain('page-debug-payment-logs');
  });

  it('merges shell and page steps with expected nav areas', () => {
    const navTargets = ADMIN_ONBOARDING_STEP_DEFINITIONS.filter((step) =>
      step.target?.startsWith('nav-'),
    ).map((step) => step.target);
    expect(navTargets).toContain('nav-support-reports');
    expect(navTargets).toContain('nav-debug');
    expect(ADMIN_ONBOARDING_STEP_DEFINITIONS.length).toBe(49);
  });

  it('marks every drive step with disableActiveInteraction', () => {
    const steps = buildAdminOnboardingDriveSteps(
      { push: () => undefined },
      () => '/admin',
    );
    for (const step of steps) {
      expect(step.disableActiveInteraction).toBe(true);
    }
  });

  it('closes mobile sidebar for new page targets', () => {
    expect(shouldCloseMobileSidebarForOnboardingStep('page-support-reports-table')).toBe(true);
    expect(shouldCloseMobileSidebarForOnboardingStep('page-debug-tabs')).toBe(true);
    expect(shouldCloseMobileSidebarForOnboardingStep('page-debug-client-diagnostic')).toBe(true);
    expect(shouldCloseMobileSidebarForOnboardingStep('page-debug-cron-logs')).toBe(true);
    expect(shouldCloseMobileSidebarForOnboardingStep('page-debug-payment-logs')).toBe(true);
    expect(shouldCloseMobileSidebarForOnboardingStep('page-bookings-view-toggle')).toBe(true);
    expect(shouldCloseMobileSidebarForOnboardingStep('page-bookings-table')).toBe(true);
    expect(shouldCloseMobileSidebarForOnboardingStep('page-bookings-calendar')).toBe(true);
  });
});
