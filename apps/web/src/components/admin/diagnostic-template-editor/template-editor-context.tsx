'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  buildTemplatePatchBody,
  updateTemplateWithReindex,
  DIAGNOSTIC_TEMPLATES_API_URL,
  type DiagnosticTemplateQuestionValue,
  type DiagnosticTemplateOptionValue,
  type DiagnosticTemplateRoundValue,
} from '@/components/admin/diagnostic-template-editor/diagnostic-template-editor-utils';
import {
  buildRedoHistoryState,
  buildUndoHistoryState,
  createEmptyTemplateHistoryState,
  pushTemplateHistoryEntry,
  type TemplateEditorHistoryState,
} from '@/components/admin/diagnostic-template-editor/template-editor-history';
import type { DiagnosticTemplateValue, DiagnosticTemplateVisibilityRule } from '@/lib/diagnostic-template-types';
import { notifyError, notifySuccess } from '@/lib/notify';

type TemplateApiResponse = {
  readonly template?: DiagnosticTemplateValue;
  readonly error?: string;
  readonly details?: string;
};

export type TemplateEditorSelection =
  | { readonly kind: 'round'; readonly roundId: string }
  | { readonly kind: 'question'; readonly roundId: string; readonly questionId: string }
  | { readonly kind: 'option'; readonly roundId: string; readonly questionId: string; readonly optionId: string }
  | { readonly kind: 'childQuestion'; readonly roundId: string; readonly questionId: string; readonly optionId: string }
  | null;

type TemplateEditorContextValue = {
  readonly template: DiagnosticTemplateValue;
  readonly hasUnsavedChanges: boolean;
  readonly isSaving: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly selection: TemplateEditorSelection;
  readonly setSelection: (selection: TemplateEditorSelection) => void;
  readonly updateTemplate: (
    updater: (template: DiagnosticTemplateValue) => DiagnosticTemplateValue,
    options?: { readonly shouldReindex?: boolean },
  ) => void;
  readonly executeUndo: () => void;
  readonly executeRedo: () => void;
  readonly executeSave: () => Promise<void>;
  readonly replaceTemplate: (template: DiagnosticTemplateValue) => void;
};

const TemplateEditorContext = createContext<TemplateEditorContextValue | null>(null);

type TemplateEditorProviderProps = {
  readonly initialTemplate: DiagnosticTemplateValue;
  readonly children: ReactNode;
};

export function TemplateEditorProvider(props: TemplateEditorProviderProps): ReactElement {
  const [template, setTemplate] = useState<DiagnosticTemplateValue>(props.initialTemplate);
  const [savedPatchBody, setSavedPatchBody] = useState<string>(() => buildTemplatePatchBody(props.initialTemplate));
  const [history, setHistory] = useState<TemplateEditorHistoryState>(() => createEmptyTemplateHistoryState());
  const historyRef = useRef<TemplateEditorHistoryState>(history);
  historyRef.current = history;
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [selection, setSelection] = useState<TemplateEditorSelection>(null);
  const hasUnsavedChanges = useMemo(
    () => buildTemplatePatchBody(template) !== savedPatchBody,
    [savedPatchBody, template],
  );
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const updateTemplate = useCallback(
    (
      updater: (template: DiagnosticTemplateValue) => DiagnosticTemplateValue,
      options: { readonly shouldReindex?: boolean } = {},
    ): void => {
      setTemplate((previous) => {
        const next = updateTemplateWithReindex(previous, updater, options.shouldReindex !== false);
        if (buildTemplatePatchBody(previous) === buildTemplatePatchBody(next)) {
          return previous;
        }
        setHistory((currentHistory) => pushTemplateHistoryEntry({ history: currentHistory, previousTemplate: previous }));
        return next;
      });
    },
    [],
  );
  const executeUndo = useCallback((): void => {
    setTemplate((current) => {
      const undoState = buildUndoHistoryState({ history: historyRef.current, currentTemplate: current });
      if (undoState === null) {
        return current;
      }
      setHistory(undoState.history);
      return undoState.template;
    });
  }, []);
  const executeRedo = useCallback((): void => {
    setTemplate((current) => {
      const redoState = buildRedoHistoryState({ history: historyRef.current, currentTemplate: current });
      if (redoState === null) {
        return current;
      }
      setHistory(redoState.history);
      return redoState.template;
    });
  }, []);
  const replaceTemplate = useCallback((nextTemplate: DiagnosticTemplateValue): void => {
    setTemplate(nextTemplate);
    setSavedPatchBody(buildTemplatePatchBody(nextTemplate));
    setHistory(createEmptyTemplateHistoryState());
  }, []);
  const executeSave = useCallback(async (): Promise<void> => {
    setIsSaving(true);
    try {
      const response = await fetch(`${DIAGNOSTIC_TEMPLATES_API_URL}/${template.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: buildTemplatePatchBody(template),
      });
      const data = (await response.json()) as TemplateApiResponse;
      if (!response.ok || data.template === undefined) {
        throw new Error(data.details ?? data.error ?? 'Failed to save diagnostic template.');
      }
      replaceTemplate(data.template);
      notifySuccess('Template saved.');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to save diagnostic template.');
    } finally {
      setIsSaving(false);
    }
  }, [replaceTemplate, template]);
  const value = useMemo<TemplateEditorContextValue>(
    () => ({
      template,
      hasUnsavedChanges,
      isSaving,
      canUndo,
      canRedo,
      selection,
      setSelection,
      updateTemplate,
      executeUndo,
      executeRedo,
      executeSave,
      replaceTemplate,
    }),
    [
      canRedo,
      canUndo,
      executeRedo,
      executeSave,
      executeUndo,
      hasUnsavedChanges,
      isSaving,
      replaceTemplate,
      selection,
      template,
      updateTemplate,
    ],
  );
  return <TemplateEditorContext.Provider value={value}>{props.children}</TemplateEditorContext.Provider>;
}

export function useTemplateEditor(): TemplateEditorContextValue {
  const context = useContext(TemplateEditorContext);
  if (context === null) {
    throw new Error('useTemplateEditor must be used within TemplateEditorProvider');
  }
  return context;
}

export function findRoundInTemplate(
  template: DiagnosticTemplateValue,
  roundId: string,
): { readonly round: DiagnosticTemplateRoundValue; readonly roundIndex: number } | null {
  for (const [roundIndex, round] of template.rounds.entries()) {
    if (round.id === roundId) {
      return { round, roundIndex };
    }
  }
  return null;
}

export function findQuestionInTemplate(
  template: DiagnosticTemplateValue,
  questionId: string,
): {
  readonly round: DiagnosticTemplateRoundValue;
  readonly question: DiagnosticTemplateQuestionValue;
  readonly roundIndex: number;
  readonly questionIndex: number;
} | null {
  for (const [roundIndex, round] of template.rounds.entries()) {
    for (const [questionIndex, question] of round.questions.entries()) {
      if (question.id === questionId) {
        return { round, question, roundIndex, questionIndex };
      }
    }
  }
  return null;
}

export function findOptionInTemplate(
  template: DiagnosticTemplateValue,
  optionId: string,
): {
  readonly round: DiagnosticTemplateRoundValue;
  readonly question: DiagnosticTemplateQuestionValue;
  readonly option: DiagnosticTemplateOptionValue;
  readonly roundIndex: number;
  readonly questionIndex: number;
  readonly optionIndex: number;
} | null {
  for (const [roundIndex, round] of template.rounds.entries()) {
    for (const [questionIndex, question] of round.questions.entries()) {
      for (const [optionIndex, option] of question.options.entries()) {
        if (option.id === optionId) {
          return { round, question, option, roundIndex, questionIndex, optionIndex };
        }
      }
    }
  }
  return null;
}

export function applyShowWhenToTarget(params: {
  readonly template: DiagnosticTemplateValue;
  readonly targetNodeId: string;
  readonly rule: DiagnosticTemplateVisibilityRule;
}): DiagnosticTemplateValue {
  if (params.targetNodeId.startsWith('round:')) {
    const roundId = params.targetNodeId.slice('round:'.length);
    return updateTemplateWithReindex(params.template, (template) => ({
      ...template,
      rounds: template.rounds.map((round) => (round.id === roundId ? { ...round, showWhen: params.rule } : round)),
    }));
  }
  if (params.targetNodeId.startsWith('question:')) {
    const questionId = params.targetNodeId.slice('question:'.length);
    return updateTemplateWithReindex(params.template, (template) => ({
      ...template,
      rounds: template.rounds.map((round) => ({
        ...round,
        questions: round.questions.map((question) =>
          question.id === questionId ? { ...question, showWhen: params.rule } : question,
        ),
      })),
    }));
  }
  if (params.targetNodeId.startsWith('option:')) {
    const optionId = params.targetNodeId.slice('option:'.length);
    return updateTemplateWithReindex(params.template, (template) => ({
      ...template,
      rounds: template.rounds.map((round) => ({
        ...round,
        questions: round.questions.map((question) => ({
          ...question,
          options: question.options.map((option) =>
            option.id === optionId ? { ...option, showWhen: params.rule } : option,
          ),
        })),
      })),
    }));
  }
  return params.template;
}
