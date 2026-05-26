import type { DriveStep, DriverHook } from 'driver.js';
import { ADMIN_ONBOARDING_PAGE_STEP_DEFINITIONS } from '@/lib/admin/admin-onboarding-page-steps';
import {
  matchesAdminRoute,
  waitForAdminTourElement,
} from '@/lib/admin/admin-onboarding-navigation';

export const ADMIN_ONBOARDING_WELCOME_STORAGE_KEY = 'techmd-admin-onboarding-welcome-seen';

export type AdminOnboardingShellTarget =
  | 'sidebar'
  | 'sidebar-workspace'
  | 'nav-dashboard'
  | 'nav-templates'
  | 'nav-blog'
  | 'nav-sessions'
  | 'nav-leads'
  | 'nav-users'
  | 'nav-schedule'
  | 'nav-bookings'
  | 'nav-advisor'
  | 'nav-settings'
  | 'admin-header'
  | 'appearance-controls'
  | 'guide-button';

export type AdminOnboardingPageTarget =
  | 'page-dashboard-stats'
  | 'page-dashboard-activity'
  | 'page-templates-list'
  | 'page-blog-list'
  | 'page-sessions-table'
  | 'page-leads-table'
  | 'page-users-table'
  | 'page-schedule-calendar'
  | 'page-bookings-filters'
  | 'page-bookings-calendar'
  | 'page-advisor-chat'
  | 'page-settings-tabs'
  | 'page-settings-content';

export type AdminOnboardingTourTarget = AdminOnboardingShellTarget | AdminOnboardingPageTarget;

export type AdminOnboardingStepDefinition = {
  readonly target: AdminOnboardingTourTarget | null;
  readonly title: string;
  readonly description: string;
  readonly side?: 'top' | 'right' | 'bottom' | 'left';
  readonly routePath?: string;
};

export function buildAdminTourSelector(target: AdminOnboardingTourTarget): string {
  return `[data-admin-tour="${target}"]`;
}

const ADMIN_ONBOARDING_MOBILE_SIDEBAR_CLOSED_TARGETS: ReadonlySet<AdminOnboardingTourTarget> = new Set([
  'admin-header',
  'appearance-controls',
  'guide-button',
  'page-dashboard-stats',
  'page-dashboard-activity',
  'page-templates-list',
  'page-blog-list',
  'page-sessions-table',
  'page-leads-table',
  'page-users-table',
  'page-schedule-calendar',
  'page-bookings-filters',
  'page-bookings-calendar',
  'page-advisor-chat',
  'page-settings-tabs',
  'page-settings-content',
]);

export function shouldCloseMobileSidebarForOnboardingStep(
  target: AdminOnboardingTourTarget | null,
): boolean {
  if (target === null) {
    return false;
  }
  return ADMIN_ONBOARDING_MOBILE_SIDEBAR_CLOSED_TARGETS.has(target);
}

const ADMIN_ONBOARDING_SHELL_STEP_DEFINITIONS: readonly AdminOnboardingStepDefinition[] = [
  {
    target: 'sidebar',
    title: 'Admin navigation',
    description:
      'Use the sidebar to move between every workspace. Collapse it on desktop with the arrow control to save space.',
    side: 'right',
  },
  {
    target: 'sidebar-workspace',
    title: 'Workspace overview',
    description:
      'This card summarizes what the admin console covers: diagnostics, leads, bookings, advisor tools, and configuration.',
    side: 'right',
  },
  {
    target: 'nav-dashboard',
    title: 'Dashboard',
    description: 'Your home view with operational metrics and recent activity—we will open it next.',
    side: 'right',
  },
  {
    target: 'nav-templates',
    title: 'Templates',
    description: 'Diagnostic quiz templates with rounds, questions, branching, and live activation.',
    side: 'right',
  },
  {
    target: 'nav-blog',
    title: 'Blog',
    description: 'Marketing articles with the MDX editor, revisions, and publish workflow.',
    side: 'right',
  },
  {
    target: 'nav-sessions',
    title: 'Sessions',
    description: 'Visitor diagnostic sessions with progress, answers, and booking links.',
    side: 'right',
  },
  {
    target: 'nav-leads',
    title: 'Leads',
    description: 'Contacts captured from web and native journeys.',
    side: 'right',
  },
  {
    target: 'nav-users',
    title: 'Marketing users',
    description: 'Signed-in marketing accounts with auth sessions and quiz snapshots.',
    side: 'right',
  },
  {
    target: 'nav-schedule',
    title: 'Schedule',
    description: 'Advisor availability windows and slot generation rules.',
    side: 'right',
  },
  {
    target: 'nav-bookings',
    title: 'Bookings',
    description: 'Confirmed sessions with payment status and calendar views.',
    side: 'right',
  },
  {
    target: 'nav-advisor',
    title: 'Advisor',
    description: 'Internal AI assistant for reviewing customer context.',
    side: 'right',
  },
  {
    target: 'nav-settings',
    title: 'Settings',
    description: 'Site config, pricing, payments, email, and meeting integrations.',
    side: 'right',
  },
  {
    target: 'admin-header',
    title: 'Page context',
    description: 'The header shows where you are in the admin console and stays visible while you scroll.',
    side: 'bottom',
  },
  {
    target: 'appearance-controls',
    title: 'Appearance',
    description: 'Switch light, dark, or system mode and pick an accent theme that applies across the admin UI.',
    side: 'bottom',
  },
  {
    target: 'guide-button',
    title: 'Replay this guide',
    description: 'Open the admin tour anytime from here. New features should add a step—see docs/admin-onboarding.md.',
    side: 'bottom',
  },
] as const;

type AdminOnboardingPageSegment = {
  readonly navTarget: AdminOnboardingShellTarget;
  readonly pageSteps: readonly AdminOnboardingStepDefinition[];
};

const ADMIN_ONBOARDING_PAGE_STEPS: readonly AdminOnboardingStepDefinition[] =
  ADMIN_ONBOARDING_PAGE_STEP_DEFINITIONS as readonly AdminOnboardingStepDefinition[];

const ADMIN_ONBOARDING_PAGE_SEGMENTS: readonly AdminOnboardingPageSegment[] = [
  { navTarget: 'nav-dashboard', pageSteps: ADMIN_ONBOARDING_PAGE_STEPS.slice(0, 2) },
  { navTarget: 'nav-templates', pageSteps: [ADMIN_ONBOARDING_PAGE_STEPS[2]!] },
  { navTarget: 'nav-blog', pageSteps: [ADMIN_ONBOARDING_PAGE_STEPS[3]!] },
  { navTarget: 'nav-sessions', pageSteps: [ADMIN_ONBOARDING_PAGE_STEPS[4]!] },
  { navTarget: 'nav-leads', pageSteps: [ADMIN_ONBOARDING_PAGE_STEPS[5]!] },
  { navTarget: 'nav-users', pageSteps: [ADMIN_ONBOARDING_PAGE_STEPS[6]!] },
  { navTarget: 'nav-schedule', pageSteps: [ADMIN_ONBOARDING_PAGE_STEPS[7]!] },
  { navTarget: 'nav-bookings', pageSteps: ADMIN_ONBOARDING_PAGE_STEPS.slice(8, 10) },
  { navTarget: 'nav-advisor', pageSteps: [ADMIN_ONBOARDING_PAGE_STEPS[10]!] },
  { navTarget: 'nav-settings', pageSteps: ADMIN_ONBOARDING_PAGE_STEPS.slice(11, 13) },
] as const;

function buildAdminOnboardingFullStepDefinitions(): readonly AdminOnboardingStepDefinition[] {
  const introSteps = ADMIN_ONBOARDING_SHELL_STEP_DEFINITIONS.slice(0, 2);
  const footerSteps = ADMIN_ONBOARDING_SHELL_STEP_DEFINITIONS.slice(-3);
  const segmentSteps: AdminOnboardingStepDefinition[] = [];
  for (const segment of ADMIN_ONBOARDING_PAGE_SEGMENTS) {
    const navStep = ADMIN_ONBOARDING_SHELL_STEP_DEFINITIONS.find((step) => step.target === segment.navTarget);
    if (navStep !== undefined) {
      segmentSteps.push(navStep);
    }
    segmentSteps.push(...segment.pageSteps);
  }
  return [...introSteps, ...segmentSteps, ...footerSteps];
}

export const ADMIN_ONBOARDING_STEP_DEFINITIONS: readonly AdminOnboardingStepDefinition[] =
  buildAdminOnboardingFullStepDefinitions();

export function resolveAdminOnboardingStepDefinition(stepIndex: number): AdminOnboardingStepDefinition | undefined {
  return ADMIN_ONBOARDING_STEP_DEFINITIONS[stepIndex];
}

export function hasSeenAdminOnboardingWelcome(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }
  return window.localStorage.getItem(ADMIN_ONBOARDING_WELCOME_STORAGE_KEY) === 'true';
}

export function markAdminOnboardingWelcomeSeen(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(ADMIN_ONBOARDING_WELCOME_STORAGE_KEY, 'true');
}

function resolvePopoverSide(side: AdminOnboardingStepDefinition['side']): 'top' | 'right' | 'bottom' | 'left' {
  return side ?? 'bottom';
}

type AdminOnboardingRouter = {
  readonly push: (href: string) => void;
};

function createRouteNavigationHook(
  definition: AdminOnboardingStepDefinition,
  router: AdminOnboardingRouter,
  resolvePathname: () => string,
): DriverHook | undefined {
  if (definition.routePath === undefined || definition.target === null) {
    return undefined;
  }
  return (_element, _step, { driver, state }) => {
    const pathname = resolvePathname();
    if (matchesAdminRoute(pathname, definition.routePath!)) {
      return;
    }
    router.push(definition.routePath!);
    void waitForAdminTourElement(definition.target!).then((element) => {
      const stepIndex = state.activeIndex;
      if (element === null) {
        driver.moveNext();
        return;
      }
      if (stepIndex !== undefined) {
        driver.moveTo(stepIndex);
      }
    });
  };
}

export function buildAdminOnboardingDriveSteps(
  router: AdminOnboardingRouter,
  resolvePathname: () => string,
): DriveStep[] {
  return ADMIN_ONBOARDING_STEP_DEFINITIONS.map((step) => {
    const routeHook = createRouteNavigationHook(step, router, resolvePathname);
    if (step.target === null) {
      return {
        onHighlightStarted: routeHook,
        popover: {
          title: step.title,
          description: step.description,
          side: resolvePopoverSide(step.side),
        },
      };
    }
    return {
      element: buildAdminTourSelector(step.target),
      onHighlightStarted: routeHook,
      popover: {
        title: step.title,
        description: step.description,
        side: resolvePopoverSide(step.side),
      },
    };
  });
}
