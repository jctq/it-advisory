import type { DiagnosticTemplateValue } from '@/lib/diagnostic-template-types';

export function wouldCreateShowWhenCycle(params: {
  readonly template: DiagnosticTemplateValue;
  readonly sourceQuestionId: string;
  readonly targetQuestionId: string | null;
}): boolean {
  if (params.targetQuestionId === null || params.sourceQuestionId === params.targetQuestionId) {
    return params.sourceQuestionId === params.targetQuestionId;
  }
  const dependentsBySource = buildDependentsMap(params.template);
  const visited = new Set<string>();
  function collectsDependents(questionId: string): boolean {
    if (questionId === params.sourceQuestionId) {
      return true;
    }
    if (visited.has(questionId)) {
      return false;
    }
    visited.add(questionId);
    const dependents = dependentsBySource.get(questionId) ?? [];
    return dependents.some((dependentId) => collectsDependents(dependentId));
  }
  return collectsDependents(params.targetQuestionId);
}

function buildDependentsMap(template: DiagnosticTemplateValue): Map<string, string[]> {
  const map = new Map<string, string[]>();
  function addDependency(sourceQuestionId: string, dependentQuestionId: string): void {
    const existing = map.get(sourceQuestionId) ?? [];
    if (!existing.includes(dependentQuestionId)) {
      map.set(sourceQuestionId, [...existing, dependentQuestionId]);
    }
  }
  for (const round of template.rounds) {
    for (const question of round.questions) {
      if (question.showWhen !== null) {
        addDependency(question.showWhen.sourceQuestionId, question.id);
      }
      for (const option of question.options) {
        if (option.showWhen !== null && option.showWhen.sourceQuestionId !== question.id) {
          addDependency(option.showWhen.sourceQuestionId, question.id);
        }
      }
    }
  }
  return map;
}

export function isSourceEarlierThanTarget(params: {
  readonly template: DiagnosticTemplateValue;
  readonly sourceQuestionId: string;
  readonly targetRoundIndex: number;
  readonly targetQuestionIndex?: number;
}): boolean {
  let sourceRoundIndex = -1;
  let sourceQuestionIndex = -1;
  for (const [roundIndex, round] of params.template.rounds.entries()) {
    for (const [questionIndex, question] of round.questions.entries()) {
      if (question.id === params.sourceQuestionId) {
        sourceRoundIndex = roundIndex;
        sourceQuestionIndex = questionIndex;
      }
    }
  }
  if (sourceRoundIndex === -1) {
    return false;
  }
  if (params.targetQuestionIndex === undefined) {
    return sourceRoundIndex < params.targetRoundIndex;
  }
  return (
    sourceRoundIndex < params.targetRoundIndex ||
    (sourceRoundIndex === params.targetRoundIndex && sourceQuestionIndex < params.targetQuestionIndex)
  );
}

export function resolveQuestionIdForNodeTarget(params: {
  readonly template: DiagnosticTemplateValue;
  readonly targetNodeId: string;
}): string | null {
  if (params.targetNodeId.startsWith('question:')) {
    return params.targetNodeId.slice('question:'.length);
  }
  if (params.targetNodeId.startsWith('option:')) {
    const optionId = params.targetNodeId.slice('option:'.length);
    for (const round of params.template.rounds) {
      for (const question of round.questions) {
        if (question.options.some((option) => option.id === optionId)) {
          return question.id;
        }
      }
    }
  }
  return null;
}
