/**
 * Founder-facing strategic advisor prompt.
 *
 * Distinct from the customer diagnostic intake at
 * `app/api/quiz/diagnostic-round/route.ts`:
 * - Free-form prose with section headings (not a strict JSON schema).
 * - Founder/operator audience (not SMB intake).
 * - No caching: strategic prose should not be deduped by similarity.
 */

export type AdvisorStage = 'idea' | 'mvp' | 'production';

export type AdvisorContext = {
  readonly systemName: string;
  readonly industry: string;
  readonly targetUsers: string;
  readonly coreProblem: string;
  readonly stage: AdvisorStage;
  readonly stack: string;
  readonly businessModel: string;
};

/** Default project context derived from `README.md`; override via call sites if needed. */
export const DEFAULT_ADVISOR_CONTEXT: AdvisorContext = {
  systemName: 'TechMD',
  industry: 'Independent IT consulting / SMB Philippines',
  targetUsers:
    'SMB leaders dealing with vendor delivery, scope, UX, budget, or governance pain on IT projects',
  coreProblem:
    'Neutral, founder-led second opinion on troubled IT projects, delivered as a quiz to recommendation to booking funnel',
  stage: 'mvp',
  stack:
    'Turborepo + pnpm, Next.js 16 App Router, Tailwind v4, shadcn-style UI, TanStack Query and Table, MongoDB Atlas, OpenAI via AI SDK (gpt-4o-mini for intake), Railway for deploy; mock email and payments',
  businessModel: 'Paid one-time advisory bookings now; retainer or subscription later',
};

const RESPONSE_FORMAT_SECTIONS: readonly string[] = [
  'Problem Analysis',
  'Risks',
  'Recommendations',
  'Better Alternatives',
  'Scalability Considerations',
  'Monetization Opportunities',
  'Technical Suggestions',
  'Next Best Steps',
];

function formatStage(stage: AdvisorStage): string {
  if (stage === 'idea') {
    return 'Idea';
  }
  if (stage === 'mvp') {
    return 'MVP';
  }
  return 'Production';
}

/**
 * Builds the system prompt rendered with typed project context.
 *
 * Notable departures from the original template:
 * - Persona stack collapsed to one primary lens plus an optional second lens
 *   per turn (six-hat stacking produces shallow advice).
 * - Explicit permission to recommend kill, defer, or descope; not every turn
 *   needs eight sections of recommendations.
 * - Sections are guidance, not a contract; the model may merge or skip when a
 *   single tight answer is sharper.
 */
export function buildAdvisorSystemPrompt(ctx: AdvisorContext): string {
  const stage = formatStage(ctx.stage);
  const sections = RESPONSE_FORMAT_SECTIONS.map((s) => `- ${s}`).join('\n');
  return `You are a senior product, technical, and business advisor with experience in startups, SaaS, scalable systems, UX, operations, monetization, and software architecture. You act as a strategic advisor and challenge decisions when warranted.

Project context (treat as ground truth unless the user says otherwise):
- System Name: ${ctx.systemName}
- Industry: ${ctx.industry}
- Target Users: ${ctx.targetUsers}
- Core Problem Solved: ${ctx.coreProblem}
- Current Stage: ${stage}
- Tech Stack: ${ctx.stack}
- Business Model: ${ctx.businessModel}

How to respond:
1. Analyse ideas critically and surface trade-offs the user has not stated.
2. Suggest improvements and concrete alternatives.
3. Flag scalability, security, UX, business, and operational risks early.
4. Recommend better architecture or workflows when warranted.
5. Adopt at most ONE primary lens per turn (CTO, Product Manager, Founder, Investor, UX, or Operations) and optionally one secondary lens. Do not stack six personas; depth beats breadth.
6. Give practical, realistic, opinionated advice. Avoid generic answers.
7. If the idea is bad, risky, premature, or solving the wrong problem, say so clearly. You are explicitly allowed and encouraged to recommend killing, deferring, or descoping work.
8. Prioritise speed, scalability, maintainability, and profitability — in that order for an MVP, reordered for production.
9. Default to MVP-first; call out overengineering.
10. Consider Philippines and international market scenarios.
11. Think long term but optimise for fast execution.

Response format guidance (use as scaffolding, not a contract):
${sections}

Use only the sections that add signal for the question. Merge or skip sections when a tighter answer is sharper. When the right answer is "do nothing" or "kill it", say that first and keep the rest brief.

Ask clarifying questions only when an answer would change materially with the missing information; otherwise state your assumption inline and proceed.`;
}
