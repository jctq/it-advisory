'use client';

import { Layers, ListChecks, MessageSquare, Plus } from 'lucide-react';
import type { ReactElement } from 'react';
import { WorkspaceTooltip } from '@/components/admin/diagnostic-template-editor/workspace-tooltip';
import { Button } from '@/components/ui/button';
import {
  createDraftChildQuestion,
  createDraftOption,
  createDraftQuestion,
  createDraftRound,
} from '@/components/admin/diagnostic-template-editor/diagnostic-template-editor-utils';
import {
  useTemplateEditor,
  type TemplateEditorSelection,
} from '@/components/admin/diagnostic-template-editor/template-editor-context';
import {
  WORKSPACE_CHROME_OUTLINE_BUTTON_CLASS,
  WORKSPACE_CHROME_SHELL_CLASS,
} from '@/components/admin/diagnostic-template-editor/workspace-theme';
import type { DiagnosticTemplateValue } from '@/lib/diagnostic-template-types';
import { cn } from '@/lib/utils';

type TemplateWorkspacePaletteProps = {
  readonly selectedRoundId: string | null;
  readonly selectedQuestionId: string | null;
  readonly selectedOptionId: string | null;
};

export function TemplateWorkspacePalette(props: TemplateWorkspacePaletteProps): ReactElement {
  const { template, updateTemplate, setSelection } = useTemplateEditor();
  function executeAddRound(): void {
    const nextRound = createDraftRound(template.rounds.length);
    updateTemplate((current) => ({
      ...current,
      rounds: [...current.rounds, nextRound],
    }));
    setSelection({ kind: 'round', roundId: nextRound.id });
  }
  function executeAddQuestion(): void {
    const roundId = props.selectedRoundId ?? template.rounds[template.rounds.length - 1]?.id;
    if (roundId === undefined) {
      executeAddRound();
      return;
    }
    const targetRound = template.rounds.find((round) => round.id === roundId);
    if (targetRound === undefined) {
      return;
    }
    const nextQuestion = createDraftQuestion(targetRound.questions.length);
    updateTemplate((current) => ({
      ...current,
      rounds: current.rounds.map((round) =>
        round.id === roundId ? { ...round, questions: [...round.questions, nextQuestion] } : round,
      ),
    }));
    setSelection({ kind: 'question', roundId, questionId: nextQuestion.id });
  }
  function executeAddOption(): void {
    const roundId = props.selectedRoundId ?? template.rounds[0]?.id;
    const questionId = props.selectedQuestionId ?? template.rounds.find((round) => round.id === roundId)?.questions[0]?.id;
    if (roundId === undefined || questionId === undefined) {
      executeAddQuestion();
      return;
    }
    const targetRound = template.rounds.find((round) => round.id === roundId);
    const targetQuestion = targetRound?.questions.find((question) => question.id === questionId);
    if (targetQuestion === undefined) {
      return;
    }
    const nextOption = createDraftOption(targetQuestion.options.length);
    updateTemplate((current) => ({
      ...current,
      rounds: current.rounds.map((round) =>
        round.id === roundId
          ? {
              ...round,
              questions: round.questions.map((question) =>
                question.id === questionId ? { ...question, options: [...question.options, nextOption] } : question,
              ),
            }
          : round,
      ),
    }));
    setSelection({ kind: 'option', roundId, questionId, optionId: nextOption.id });
  }
  function executeAddChildQuestion(): void {
    const roundId = props.selectedRoundId;
    const questionId = props.selectedQuestionId;
    const optionId = props.selectedOptionId;
    if (roundId === null || questionId === null || optionId === null) {
      return;
    }
    const nextChild = createDraftChildQuestion();
    updateTemplate((current) => ({
      ...current,
      rounds: current.rounds.map((round) =>
        round.id === roundId
          ? {
              ...round,
              questions: round.questions.map((question) =>
                question.id === questionId
                  ? {
                      ...question,
                      options: question.options.map((option) =>
                        option.id === optionId ? { ...option, childQuestion: nextChild } : option,
                      ),
                    }
                  : question,
              ),
            }
          : round,
      ),
    }));
    setSelection({ kind: 'childQuestion', roundId, questionId, optionId });
  }
  const iconButtonClass = cn('size-7 shrink-0', WORKSPACE_CHROME_OUTLINE_BUTTON_CLASS);
  return (
    <div
      className={cn('flex items-center gap-0.5 rounded-lg p-0.5', WORKSPACE_CHROME_SHELL_CLASS)}
      role="toolbar"
      aria-label="Add nodes"
    >
      <WorkspaceTooltip label="Add round">
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Add round"
          className={iconButtonClass}
          onClick={executeAddRound}
        >
          <Layers className="size-3.5" aria-hidden />
        </Button>
      </WorkspaceTooltip>
      <WorkspaceTooltip label="Add question">
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Add question"
          className={iconButtonClass}
          onClick={executeAddQuestion}
        >
          <MessageSquare className="size-3.5" aria-hidden />
        </Button>
      </WorkspaceTooltip>
      <WorkspaceTooltip label="Add option">
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Add option"
          className={iconButtonClass}
          onClick={executeAddOption}
        >
          <ListChecks className="size-3.5" aria-hidden />
        </Button>
      </WorkspaceTooltip>
      <WorkspaceTooltip label="Add child question to selected option">
        <span className="inline-flex">
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Add child question"
            className={iconButtonClass}
            onClick={executeAddChildQuestion}
            disabled={props.selectedOptionId === null}
          >
            <Plus className="size-3.5" aria-hidden />
          </Button>
        </span>
      </WorkspaceTooltip>
    </div>
  );
}

export function selectionFromNodeId(nodeId: string, template: DiagnosticTemplateValue): TemplateEditorSelection {
  if (nodeId.startsWith('round:')) {
    return { kind: 'round', roundId: nodeId.slice('round:'.length) };
  }
  if (nodeId.startsWith('question:')) {
    const questionId = nodeId.slice('question:'.length);
    for (const round of template.rounds) {
      if (round.questions.some((question) => question.id === questionId)) {
        return { kind: 'question', roundId: round.id, questionId };
      }
    }
  }
  if (nodeId.startsWith('option:')) {
    const optionId = nodeId.slice('option:'.length);
    for (const round of template.rounds) {
      for (const question of round.questions) {
        const option = question.options.find((candidate) => candidate.id === optionId);
        if (option !== undefined) {
          return { kind: 'option', roundId: round.id, questionId: question.id, optionId };
        }
      }
    }
  }
  if (nodeId.startsWith('child:')) {
    const childId = nodeId.slice('child:'.length);
    for (const round of template.rounds) {
      for (const question of round.questions) {
        for (const option of question.options) {
          if (option.childQuestion?.id === childId) {
            return { kind: 'childQuestion', roundId: round.id, questionId: question.id, optionId: option.id };
          }
        }
      }
    }
  }
  return null;
}
