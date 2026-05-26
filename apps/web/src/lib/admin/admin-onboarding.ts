import type { DriveStep } from 'driver.js';

export const ADMIN_ONBOARDING_WELCOME_STORAGE_KEY = 'techmd-admin-onboarding-welcome-seen';

export type AdminOnboardingTourTarget =
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

export type AdminOnboardingStepDefinition = {
  readonly target: AdminOnboardingTourTarget | null;
  readonly title: string;
  readonly description: string;
  readonly side?: 'top' | 'right' | 'bottom' | 'left';
};

export function buildAdminTourSelector(target: AdminOnboardingTourTarget): string {
  return `[data-admin-tour="${target}"]`;
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

export const ADMIN_ONBOARDING_STEP_DEFINITIONS: readonly AdminOnboardingStepDefinition[] = [
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
    description:
      'Your home view with key counts, this week’s bookings, recent leads, and quick links into each area.',
    side: 'right',
  },
  {
    target: 'nav-templates',
    title: 'Templates',
    description:
      'Build and maintain diagnostic quiz templates—rounds, questions, branching, and activation for the live quiz.',
    side: 'right',
  },
  {
    target: 'nav-blog',
    title: 'Blog',
    description: 'Create and edit marketing blog posts with the MDX editor, revisions, and publish workflow.',
    side: 'right',
  },
  {
    target: 'nav-sessions',
    title: 'Sessions',
    description:
      'Review visitor diagnostic sessions: progress, answers, completion state, and links to related bookings.',
    side: 'right',
  },
  {
    target: 'nav-leads',
    title: 'Leads',
    description: 'Contacts captured from web and native journeys—filter, inspect, and follow up on prospects.',
    side: 'right',
  },
  {
    target: 'nav-users',
    title: 'Marketing users',
    description: 'Signed-in marketing accounts with auth sessions and saved quiz snapshots.',
    side: 'right',
  },
  {
    target: 'nav-schedule',
    title: 'Schedule',
    description: 'Advisor availability windows, slot caps, and rules that power bookable times on the site.',
    side: 'right',
  },
  {
    target: 'nav-bookings',
    title: 'Bookings',
    description:
      'Confirmed advisory sessions with payment status, diagnostic snapshots, and calendar views.',
    side: 'right',
  },
  {
    target: 'nav-advisor',
    title: 'Advisor',
    description: 'Internal AI assistant for reviewing customer context and drafting responses.',
    side: 'right',
  },
  {
    target: 'nav-settings',
    title: 'Settings',
    description:
      'General site config, pricing, payments, email, and meeting integrations (Google Meet, branding, and more).',
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

function resolvePopoverSide(
  side: AdminOnboardingStepDefinition['side'],
): DriveStep['popover'] extends infer P
  ? P extends { side?: infer S }
    ? S
    : never
  : never {
  return side ?? 'bottom';
}

export function buildAdminOnboardingDriveSteps(): DriveStep[] {
  return ADMIN_ONBOARDING_STEP_DEFINITIONS.map((step) => {
    if (step.target === null) {
      return {
        popover: {
          title: step.title,
          description: step.description,
          side: resolvePopoverSide(step.side),
        },
      };
    }
    return {
      element: buildAdminTourSelector(step.target),
      popover: {
        title: step.title,
        description: step.description,
        side: resolvePopoverSide(step.side),
      },
    };
  });
}
