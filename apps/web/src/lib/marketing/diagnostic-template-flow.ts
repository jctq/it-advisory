import type {
  ActiveGuidedRound,
  CompletedRoundBundle,
  DiagnosticThreadRound,
  GuidedDiagnosticOutcome,
} from '@it-advisory/diagnostic-core/guided-diagnostic-types';
import {
  buildDiagnosticAnswerLookup,
  findFirstVisibleQuestionIndex,
  formatGuidedQuestionAnswer,
  isVisibilityRuleMatched,
  normalizeDiagnosticOptions,
} from '@/lib/marketing/guided-diagnostic-types';
import { getSituationDisplayList } from '@/lib/marketing/situation-options';
import type { PublicDiagnosticTemplateValue } from '@/lib/diagnostic-template-types';

function countAnsweredQuestions(bundles: readonly CompletedRoundBundle[]): number {
  return bundles.reduce((total, bundle) => total + bundle.questions.length, 0);
}

function buildSituationHint(initialPrompt: string, bundles: readonly CompletedRoundBundle[]): string {
  const trimmedPrompt = initialPrompt.trim();
  if (trimmedPrompt.length > 0) {
    return trimmedPrompt;
  }
  return bundles
    .flatMap((bundle) =>
      bundle.questions.map((question) =>
        formatGuidedQuestionAnswer({
          question,
          selection: bundle.answers[question.id],
          detailNote: bundle.answerNotes[question.id] ?? '',
        }),
      ),
    )
    .filter((value) => value.trim().length > 0)
    .join('\n');
}

function buildSituationHintFromRounds(initialPrompt: string, rounds: readonly DiagnosticThreadRound[]): string {
  const trimmedPrompt = initialPrompt.trim();
  if (trimmedPrompt.length > 0) {
    return trimmedPrompt;
  }
  return rounds
    .flatMap((round) => round.qa.map((row) => row.answer))
    .filter((value) => value.trim().length > 0)
    .join('\n');
}

export function buildTemplateMappedSituation(
  initialPrompt: string,
  bundles: readonly CompletedRoundBundle[],
): string {
  const situationHint = buildSituationHint(initialPrompt, bundles);
  return getSituationDisplayList(situationHint, 1)[0] ?? 'Not sure yet — need clarity first';
}

export function buildTemplateMappedSituationFromRounds(
  initialPrompt: string,
  rounds: readonly DiagnosticThreadRound[],
): string {
  const situationHint = buildSituationHintFromRounds(initialPrompt, rounds);
  return getSituationDisplayList(situationHint, 1)[0] ?? 'Not sure yet — need clarity first';
}

export function buildTemplateFallbackAdvisorSummary(
  templateName: string,
  initialPrompt: string,
  rounds: readonly DiagnosticThreadRound[],
): string {
  const answeredSelections = rounds
    .flatMap((round) =>
      round.qa.map((row) => ({
        roundIndex: round.roundIndex,
        question: row.question.trim(),
        answer: row.answer.trim(),
      })),
    )
    .filter((item) => item.question.length > 0 || item.answer.length > 0);
  const topSelections = answeredSelections
    .slice(0, 5)
    .map((item) => `Round ${item.roundIndex + 1}: ${item.question || 'Question'} -> ${item.answer || 'No answer captured'}`);
  const contextLead =
    initialPrompt.trim().length > 0
      ? `Customer context: ${initialPrompt.trim()}`
      : `Customer completed the "${templateName}" diagnostic template without an opening free-text prompt.`;
  const selectionLead =
    topSelections.length > 0
      ? `Captured selections:\n- ${topSelections.join('\n- ')}`
      : 'Captured selections were limited, so the advisor should review the transcript directly during the call.';
  return `${contextLead}\n\n${selectionLead}\n\nUse the transcript below to confirm specifics, clarify timeline and impact, and identify the first practical next step.`;
}

export function buildActiveRoundFromTemplate(
  template: PublicDiagnosticTemplateValue,
  roundIndex: number,
  completedBundles: readonly CompletedRoundBundle[] = [],
): ActiveGuidedRound | null {
  const round = template.rounds[roundIndex];
  if (
    round === undefined ||
    !isVisibilityRuleMatched({
      answers: buildDiagnosticAnswerLookup({
        completedBundles,
      }),
      rule: round.showWhen,
    })
  ) {
    return null;
  }
  const questions = round.questions.map((question) => ({
    id: question.id,
    prompt: question.prompt,
    description: question.description,
    showWhen: question.showWhen,
    type: question.type,
    rankedOptionLimit: question.rankedOptionLimit,
    selectionMode: question.selectionMode,
    options: normalizeDiagnosticOptions(question.options),
  }));
  const stepIndex = findFirstVisibleQuestionIndex({
    questions,
    baseAnswers: buildDiagnosticAnswerLookup({
      completedBundles,
    }),
    answers: {},
  });
  if (stepIndex === null) {
    return null;
  }
  return {
    roundIndex,
    roundTitle: round.title,
    questions,
    answers: {},
    answerNotes: {},
    stepIndex,
    guidance: round.guidance,
  };
}

export function buildNextTemplateRoundFromState(params: {
  readonly completedBundles: readonly CompletedRoundBundle[];
  readonly startRoundIndex: number;
  readonly template: PublicDiagnosticTemplateValue;
}): ActiveGuidedRound | null {
  for (let roundIndex = params.startRoundIndex; roundIndex < params.template.rounds.length; roundIndex += 1) {
    const activeRound = buildActiveRoundFromTemplate(params.template, roundIndex, params.completedBundles);
    if (activeRound !== null) {
      return activeRound;
    }
  }
  return null;
}

export function listVisibleTemplateRoundSummaries(params: {
  readonly activeRound: ActiveGuidedRound | null;
  readonly completedBundles: readonly CompletedRoundBundle[];
  readonly template: PublicDiagnosticTemplateValue;
}): readonly {
  readonly authoredRoundIndex: number;
  readonly id: string;
  readonly title: string;
}[] {
  const answers = buildDiagnosticAnswerLookup({
    completedBundles: params.completedBundles,
    activeRound: params.activeRound,
  });
  return params.template.rounds.flatMap((round, roundIndex) =>
    isVisibilityRuleMatched({
      answers,
      rule: round.showWhen,
    })
      ? [
          {
            authoredRoundIndex: roundIndex,
            id: round.id,
            title: round.title,
          },
        ]
      : [],
  );
}

export function buildTemplateDiagnosticOutcome(
  initialPrompt: string,
  bundles: readonly CompletedRoundBundle[],
  template: PublicDiagnosticTemplateValue,
  advisorSummary: string,
): GuidedDiagnosticOutcome {
  return {
    mappedSituation: buildTemplateMappedSituation(initialPrompt, bundles),
    advisorSummary: advisorSummary.trim().length > 0
      ? advisorSummary.trim()
      : `Completed the "${template.name}" diagnostic template with ${bundles.length} rounds and ${countAnsweredQuestions(bundles)} questions.`,
  };
}
