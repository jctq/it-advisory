import {
  buildChildQuestionNodeId,
  buildOptionNodeId,
  buildQuestionNodeId,
} from '@/components/admin/diagnostic-template-editor/build-workspace-graph';
import {
  findOptionById,
  findQuestionById,
  updateTemplateWithReindex,
} from '@/components/admin/diagnostic-template-editor/diagnostic-template-editor-utils';
import type {
  DiagnosticTemplateChildQuestionValue,
  DiagnosticTemplateQuestionValue,
} from '@/lib/diagnostic-template-types';
import type { DiagnosticTemplateValue } from '@/lib/diagnostic-template-types';

export function parseQuestionIdFromNodeId(nodeId: string): string | null {
  return nodeId.startsWith('question:') ? nodeId.slice('question:'.length) : null;
}

export function parseOptionIdFromNodeId(nodeId: string): string | null {
  return nodeId.startsWith('option:') ? nodeId.slice('option:'.length) : null;
}

export function parseChildQuestionIdFromNodeId(nodeId: string): string | null {
  return nodeId.startsWith('child:') ? nodeId.slice('child:'.length) : null;
}

export function parseRoundIdFromNodeId(nodeId: string): string | null {
  return nodeId.startsWith('round:') ? nodeId.slice('round:'.length) : null;
}

function findChildQuestionOwner(
  template: DiagnosticTemplateValue,
  childQuestionId: string,
): {
  readonly roundId: string;
  readonly questionId: string;
  readonly optionId: string;
  readonly childQuestion: DiagnosticTemplateChildQuestionValue;
} | null {
  for (const round of template.rounds) {
    for (const question of round.questions) {
      for (const option of question.options) {
        if (option.childQuestion?.id === childQuestionId) {
          return {
            roundId: round.id,
            questionId: question.id,
            optionId: option.id,
            childQuestion: option.childQuestion,
          };
        }
      }
    }
  }
  return null;
}

export function moveQuestionToRound(params: {
  readonly template: DiagnosticTemplateValue;
  readonly questionId: string;
  readonly targetRoundId: string;
}): DiagnosticTemplateValue {
  const sourceMeta = findQuestionById(params.template, params.questionId);
  if (sourceMeta === null) {
    return params.template;
  }
  if (sourceMeta.round.id === params.targetRoundId) {
    return params.template;
  }
  const movedQuestion = sourceMeta.question;
  return updateTemplateWithReindex(params.template, (current) => {
    const roundsWithoutQuestion = current.rounds.map((round) => ({
      ...round,
      questions: round.questions.filter((question) => question.id !== params.questionId),
    }));
    return {
      ...current,
      rounds: roundsWithoutQuestion.map((round) =>
        round.id === params.targetRoundId
          ? { ...round, questions: [...round.questions, movedQuestion] }
          : round,
      ),
    };
  });
}

export function moveQuestionAfterPredecessor(params: {
  readonly template: DiagnosticTemplateValue;
  readonly questionId: string;
  readonly predecessorQuestionId: string;
}): DiagnosticTemplateValue {
  const predecessorMeta = findQuestionById(params.template, params.predecessorQuestionId);
  const movedMeta = findQuestionById(params.template, params.questionId);
  if (predecessorMeta === null || movedMeta === null) {
    return params.template;
  }
  if (predecessorMeta.question.id === movedMeta.question.id) {
    return params.template;
  }
  const movedQuestion = movedMeta.question;
  return updateTemplateWithReindex(params.template, (current) => {
    const roundsWithoutQuestion = current.rounds.map((round) => ({
      ...round,
      questions: round.questions.filter((question) => question.id !== params.questionId),
    }));
    const targetRound = roundsWithoutQuestion.find((round) => round.id === predecessorMeta.round.id);
    if (targetRound === undefined) {
      return current;
    }
    const predecessorIndex = targetRound.questions.findIndex(
      (question) => question.id === params.predecessorQuestionId,
    );
    if (predecessorIndex === -1) {
      return current;
    }
    const nextQuestions = [...targetRound.questions];
    nextQuestions.splice(predecessorIndex + 1, 0, movedQuestion);
    return {
      ...current,
      rounds: roundsWithoutQuestion.map((round) =>
        round.id === predecessorMeta.round.id ? { ...round, questions: nextQuestions } : round,
      ),
    };
  });
}

export function moveOptionToQuestion(params: {
  readonly template: DiagnosticTemplateValue;
  readonly optionId: string;
  readonly targetQuestionId: string;
}): DiagnosticTemplateValue {
  const optionMeta = findOptionById(params.template, params.optionId);
  const targetMeta = findQuestionById(params.template, params.targetQuestionId);
  if (optionMeta === null || targetMeta === null) {
    return params.template;
  }
  if (optionMeta.question.id === params.targetQuestionId) {
    return params.template;
  }
  const movedOption = optionMeta.option;
  const withoutOption = updateTemplateWithReindex(
    params.template,
    (current) => ({
      ...current,
      rounds: current.rounds.map((round) =>
        round.id === optionMeta.round.id
          ? {
              ...round,
              questions: round.questions.map((question) =>
                question.id === optionMeta.question.id
                  ? {
                      ...question,
                      options: question.options.filter((option) => option.id !== params.optionId),
                    }
                  : question,
              ),
            }
          : round,
      ),
    }),
    false,
  );
  return updateTemplateWithReindex(withoutOption, (current) => ({
    ...current,
    rounds: current.rounds.map((round) =>
      round.id === targetMeta.round.id
        ? {
            ...round,
            questions: round.questions.map((question) =>
              question.id === params.targetQuestionId
                ? { ...question, options: [...question.options, movedOption] }
                : question,
            ),
          }
        : round,
    ),
  }));
}

export function moveChildQuestionToOption(params: {
  readonly template: DiagnosticTemplateValue;
  readonly childQuestionId: string;
  readonly targetOptionId: string;
}): DiagnosticTemplateValue {
  const owner = findChildQuestionOwner(params.template, params.childQuestionId);
  const targetMeta = findOptionById(params.template, params.targetOptionId);
  if (owner === null || targetMeta === null) {
    return params.template;
  }
  if (owner.optionId === params.targetOptionId) {
    return params.template;
  }
  if (targetMeta.option.childQuestion !== null) {
    return params.template;
  }
  const movedChild = owner.childQuestion;
  return updateTemplateWithReindex(params.template, (current) => ({
    ...current,
    rounds: current.rounds.map((round) => ({
      ...round,
      questions: round.questions.map((question) => ({
        ...question,
        options: question.options.map((option) => {
          if (option.id === owner.optionId) {
            return { ...option, childQuestion: null };
          }
          if (option.id === params.targetOptionId) {
            return { ...option, childQuestion: movedChild };
          }
          return option;
        }),
      })),
    })),
  }));
}

export function collectWorkspaceNodeIdsForMovedQuestion(question: DiagnosticTemplateQuestionValue): readonly string[] {
  const nodeIds: string[] = [buildQuestionNodeId(question.id)];
  for (const option of question.options) {
    nodeIds.push(buildOptionNodeId(option.id));
    if (option.childQuestion !== null) {
      nodeIds.push(buildChildQuestionNodeId(option.childQuestion.id));
    }
  }
  return nodeIds;
}
