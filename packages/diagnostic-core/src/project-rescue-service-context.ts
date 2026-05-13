/**
 * Canonical copy for the Project Rescue session, shared by funnel UIs and advisor handoff prompts.
 */
export const PROJECT_RESCUE_SERVICE_TITLE = 'Project Rescue Consultation' as const;

export const PROJECT_RESCUE_SERVICE_TAGLINE =
  'A focused working session for leaders who need independent judgment — especially when timelines slip, scope churns, or vendors point fingers.' as const;

/**
 * Brief framing of what this advisor session specializes in — used in LLM prompts so headlines and hero copy stay on-offering.
 */
export const PROJECT_RESCUE_ADVISOR_SPECIALTY_CONTEXT =
  'Specialized advisory: independent project-rescue judgment—stabilizing troubled delivery, clarifying ownership, and navigating vendor/SI dynamics—not generic IT support or implementation labor.' as const;

export const PROJECT_RESCUE_WHATS_INCLUDED: readonly string[] = [
  'Review of current situation, stakeholders, and constraints',
  'Identification of delivery risks and likely root causes',
  'Decision checkpoints and options ranked by impact vs effort',
  'Vendor / SI dynamics — what to challenge and what to formalize',
  '90-day stabilization roadmap outline',
] as const;

export const PROJECT_RESCUE_GOOD_FIT_BULLETS: readonly string[] = [
  'You are mid-flight on an ERP, HRIS, CRM, or custom build',
  'Executive sponsors need a neutral read before approving more spend',
  'You want concrete next steps — not another steering deck',
] as const;

export const PROJECT_RESCUE_SESSION_DURATION = '60–90 minutes' as const;

/** Published rate line for UI (peso). */
export const PROJECT_RESCUE_PRICE_HEADLINE = 'From ₱6,000' as const;

export const PROJECT_RESCUE_BOOKING_FOOTNOTE = 'per session · delivered remotely by default' as const;

/**
 * Returns personalized hero copy when the model produced it; otherwise the canonical published tagline.
 */
export function resolveProjectRescueBriefAssessment(candidate: string | undefined | null): string {
  const trimmed = typeof candidate === 'string' ? candidate.trim() : '';
  return trimmed.length > 0 ? trimmed : PROJECT_RESCUE_SERVICE_TAGLINE;
}

/**
 * Returns a personalized session headline when the model produced it; otherwise the canonical offering title.
 */
export function resolveProjectRescueSessionTitle(candidate: string | undefined | null): string {
  const trimmed = typeof candidate === 'string' ? candidate.trim() : '';
  return trimmed.length > 0 ? trimmed : PROJECT_RESCUE_SERVICE_TITLE;
}

/**
 * Normalizes model output to exactly three "good fit if" lines; falls back to canonical bullets when invalid.
 */
export function resolveProjectRescueGoodFitBullets(candidate: readonly unknown[] | null | undefined): readonly string[] {
  const canonical = PROJECT_RESCUE_GOOD_FIT_BULLETS;
  if (!candidate || candidate.length === 0) {
    return canonical;
  }
  const strings = candidate
    .filter((item): item is string => typeof item === 'string')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (strings.length !== 3) {
    return canonical;
  }
  return strings;
}

/** Full investment line for model prompts (numeric clarity). */
export const PROJECT_RESCUE_INVESTMENT_NOTE =
  'From approximately PHP 6,000 (₱6,000) per session, delivered remotely by default' as const;

/**
 * Compact block for LLM system prompts so summaryForAdvisor aligns with the session the user can book.
 */
export function buildProjectRescueServicePromptBlock(): string {
  const bullets = PROJECT_RESCUE_WHATS_INCLUDED.map((line) => `- ${line}`).join('\n');
  return `Offering: ${PROJECT_RESCUE_SERVICE_TITLE}
Purpose: ${PROJECT_RESCUE_SERVICE_TAGLINE}
Advisor specialty (brief context — use this to anchor sessionTitle and briefAssessment; stay concise):
${PROJECT_RESCUE_ADVISOR_SPECIALTY_CONTEXT}
Duration / modality: ${PROJECT_RESCUE_SESSION_DURATION}, remote by default.
Investment: ${PROJECT_RESCUE_INVESTMENT_NOTE}
What the session covers:
${bullets}`;
}
