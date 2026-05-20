import {
  buildChildQuestionNodeId,
  buildOptionNodeId,
  buildQuestionNodeId,
  buildRoundNodeId,
} from '@/components/admin/diagnostic-template-editor/build-workspace-graph';
import {
  findOptionById,
  findQuestionById,
  updateTemplateWithReindex,
  type DiagnosticTemplateQuestionValue,
} from '@/components/admin/diagnostic-template-editor/diagnostic-template-editor-utils';
import type { DiagnosticTemplateValue } from '@/lib/diagnostic-template-types';

export function collectWorkspaceNodeIdsForQuestion(question: DiagnosticTemplateQuestionValue): readonly string[] {
  const nodeIds: string[] = [buildQuestionNodeId(question.id)];
  for (const option of question.options) {
    nodeIds.push(buildOptionNodeId(option.id));
    if (option.childQuestion !== null) {
      nodeIds.push(buildChildQuestionNodeId(option.childQuestion.id));
    }
  }
  return nodeIds;
}

export function collectWorkspaceNodeIdsForRound(round: DiagnosticTemplateValue['rounds'][number]): readonly string[] {
  const nodeIds: string[] = [buildRoundNodeId(round.id)];
  for (const question of round.questions) {
    nodeIds.push(...collectWorkspaceNodeIdsForQuestion(question));
  }
  return nodeIds;
}

export function removeQuestionFromTemplate(params: {
  readonly template: DiagnosticTemplateValue;
  readonly roundId: string;
  readonly questionId: string;
}): DiagnosticTemplateValue {
  return updateTemplateWithReindex(params.template, (current) => ({
    ...current,
    rounds: current.rounds.map((round) =>
      round.id === params.roundId
        ? { ...round, questions: round.questions.filter((question) => question.id !== params.questionId) }
        : round,
    ),
  }));
}

export function removeOptionFromTemplate(params: {
  readonly template: DiagnosticTemplateValue;
  readonly roundId: string;
  readonly questionId: string;
  readonly optionId: string;
}): DiagnosticTemplateValue {
  return updateTemplateWithReindex(params.template, (current) => ({
    ...current,
    rounds: current.rounds.map((round) =>
      round.id === params.roundId
        ? {
            ...round,
            questions: round.questions.map((question) =>
              question.id === params.questionId
                ? {
                    ...question,
                    options: question.options.filter((option) => option.id !== params.optionId),
                  }
                : question,
            ),
          }
        : round,
    ),
  }));
}

export function removeChildQuestionFromTemplate(params: {
  readonly template: DiagnosticTemplateValue;
  readonly roundId: string;
  readonly questionId: string;
  readonly optionId: string;
}): DiagnosticTemplateValue {
  return updateTemplateWithReindex(params.template, (current) => ({
    ...current,
    rounds: current.rounds.map((round) =>
      round.id === params.roundId
        ? {
            ...round,
            questions: round.questions.map((question) =>
              question.id === params.questionId
                ? {
                    ...question,
                    options: question.options.map((option) =>
                      option.id === params.optionId ? { ...option, childQuestion: null } : option,
                    ),
                  }
                : question,
            ),
          }
        : round,
    ),
  }));
}

export function removeRoundFromTemplate(params: {
  readonly template: DiagnosticTemplateValue;
  readonly roundId: string;
}): DiagnosticTemplateValue {
  return updateTemplateWithReindex(params.template, (current) => ({
    ...current,
    rounds: current.rounds.filter((round) => round.id !== params.roundId),
  }));
}

export function applyWorkspaceNodeRemovals(params: {
  readonly template: DiagnosticTemplateValue;
  readonly removedNodeIds: readonly string[];
}): { readonly template: DiagnosticTemplateValue; readonly prunedLayoutNodeIds: readonly string[] } {
  let nextTemplate = params.template;
  const prunedLayoutNodeIds = new Set<string>();
  const roundRemovals = params.removedNodeIds.filter((nodeId) => nodeId.startsWith('round:'));
  const questionRemovals = params.removedNodeIds.filter((nodeId) => nodeId.startsWith('question:'));
  const optionRemovals = params.removedNodeIds.filter((nodeId) => nodeId.startsWith('option:'));
  const childRemovals = params.removedNodeIds.filter((nodeId) => nodeId.startsWith('child:'));
  for (const nodeId of roundRemovals) {
    const roundId = nodeId.slice('round:'.length);
    const found = nextTemplate.rounds.find((round) => round.id === roundId);
    if (found === undefined) {
      continue;
    }
    for (const layoutNodeId of collectWorkspaceNodeIdsForRound(found)) {
      prunedLayoutNodeIds.add(layoutNodeId);
    }
    nextTemplate = removeRoundFromTemplate({ template: nextTemplate, roundId });
  }
  for (const nodeId of questionRemovals) {
    const questionId = nodeId.slice('question:'.length);
    const found = findQuestionById(nextTemplate, questionId);
    if (found === null) {
      continue;
    }
    for (const layoutNodeId of collectWorkspaceNodeIdsForQuestion(found.question)) {
      prunedLayoutNodeIds.add(layoutNodeId);
    }
    nextTemplate = removeQuestionFromTemplate({
      template: nextTemplate,
      roundId: found.round.id,
      questionId,
    });
  }
  for (const nodeId of optionRemovals) {
    const optionId = nodeId.slice('option:'.length);
    const found = findOptionById(nextTemplate, optionId);
    if (found === null) {
      continue;
    }
    prunedLayoutNodeIds.add(buildOptionNodeId(optionId));
    if (found.option.childQuestion !== null) {
      prunedLayoutNodeIds.add(buildChildQuestionNodeId(found.option.childQuestion.id));
    }
    nextTemplate = removeOptionFromTemplate({
      template: nextTemplate,
      roundId: found.round.id,
      questionId: found.question.id,
      optionId,
    });
  }
  for (const nodeId of childRemovals) {
    const childQuestionId = nodeId.slice('child:'.length);
    for (const round of nextTemplate.rounds) {
      for (const question of round.questions) {
        for (const option of question.options) {
          if (option.childQuestion?.id !== childQuestionId) {
            continue;
          }
          prunedLayoutNodeIds.add(buildChildQuestionNodeId(childQuestionId));
          nextTemplate = removeChildQuestionFromTemplate({
            template: nextTemplate,
            roundId: round.id,
            questionId: question.id,
            optionId: option.id,
          });
        }
      }
    }
  }
  return { template: nextTemplate, prunedLayoutNodeIds: [...prunedLayoutNodeIds] };
}
