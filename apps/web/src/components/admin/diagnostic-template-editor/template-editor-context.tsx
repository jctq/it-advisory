'use client';

import { flushSync } from 'react-dom';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode } from 'react';
import {
  buildTemplatePatchBody,
  updateTemplateWithReindex,
  DIAGNOSTIC_TEMPLATES_API_URL,
  type DiagnosticTemplateQuestionValue,
  type DiagnosticTemplateOptionValue,
  type DiagnosticTemplateRoundValue,
} from '@/components/admin/diagnostic-template-editor/diagnostic-template-editor-utils';
import {
  areWorkspaceLayoutsEqual,
  buildRedoHistoryState,
  buildUndoHistoryState,
  createEmptyTemplateHistoryState,
  pushEditorHistoryEntry,
  type TemplateEditorHistorySnapshot,
  type TemplateEditorHistoryState,
} from '@/components/admin/diagnostic-template-editor/template-editor-history';
import {
  clearWorkspaceLayout,
  readWorkspaceLayout,
  writeWorkspaceLayout,
  type WorkspaceLayoutSnapshot,
} from '@/components/admin/diagnostic-template-editor/workspace-layout-storage';
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

export function areTemplateEditorSelectionsEqual(
  left: TemplateEditorSelection,
  right: TemplateEditorSelection,
): boolean {
  if (left === right) {
    return true;
  }
  if (left === null || right === null) {
    return false;
  }
  if (left.kind !== right.kind) {
    return false;
  }
  switch (left.kind) {
    case 'round':
      return right.kind === 'round' && left.roundId === right.roundId;
    case 'question':
      return (
        right.kind === 'question' &&
        left.roundId === right.roundId &&
        left.questionId === right.questionId
      );
    case 'option':
      return (
        right.kind === 'option' &&
        left.roundId === right.roundId &&
        left.questionId === right.questionId &&
        left.optionId === right.optionId
      );
    case 'childQuestion':
      return (
        right.kind === 'childQuestion' &&
        left.roundId === right.roundId &&
        left.questionId === right.questionId &&
        left.optionId === right.optionId
      );
    default:
      return false;
  }
}

type TemplateEditorContextValue = {
  readonly template: DiagnosticTemplateValue;
  readonly layoutRevision: number;
  readonly hasUnsavedChanges: boolean;
  readonly isSaving: boolean;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly selection: TemplateEditorSelection;
  readonly setSelection: (selection: TemplateEditorSelection) => void;
  readonly updateTemplate: (
    updater: (template: DiagnosticTemplateValue) => DiagnosticTemplateValue,
    options?: { readonly shouldReindex?: boolean; readonly recordHistory?: boolean },
  ) => void;
  readonly commitWorkspaceLayout: (
    nextLayout: WorkspaceLayoutSnapshot,
    options?: { readonly previousLayout?: WorkspaceLayoutSnapshot | null; readonly recordHistory?: boolean },
  ) => void;
  readonly refreshWorkspaceLayout: () => void;
  readonly pushEditorHistorySnapshot: (previousSnapshot: TemplateEditorHistorySnapshot) => void;
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
  const templateRef = useRef<DiagnosticTemplateValue>(template);
  const [savedPatchBody, setSavedPatchBody] = useState<string>(() => buildTemplatePatchBody(props.initialTemplate));
  const [history, setHistory] = useState<TemplateEditorHistoryState>(() => createEmptyTemplateHistoryState());
  const historyRef = useRef<TemplateEditorHistoryState>(history);
  useEffect(() => {
    templateRef.current = template;
  }, [template]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  const [layoutRevision, setLayoutRevision] = useState<number>(0);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [selection, setSelectionState] = useState<TemplateEditorSelection>(null);
  const setSelection = useCallback((nextSelection: TemplateEditorSelection): void => {
    setSelectionState((currentSelection) =>
      areTemplateEditorSelectionsEqual(currentSelection, nextSelection) ? currentSelection : nextSelection,
    );
  }, []);
  const hasUnsavedChanges = useMemo(
    () => buildTemplatePatchBody(template) !== savedPatchBody,
    [savedPatchBody, template],
  );
  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;
  const bumpLayoutRevision = useCallback((): void => {
    setLayoutRevision((revision) => revision + 1);
  }, []);
  const readCurrentEditorSnapshot = useCallback((): TemplateEditorHistorySnapshot => {
    return {
      template: templateRef.current,
      layout: readWorkspaceLayout(templateRef.current.id),
    };
  }, []);
  const restoreWorkspaceLayout = useCallback(
    (layout: WorkspaceLayoutSnapshot | null): void => {
      const templateId = templateRef.current.id;
      if (layout === null) {
        clearWorkspaceLayout(templateId);
      } else {
        writeWorkspaceLayout(templateId, layout);
      }
      bumpLayoutRevision();
    },
    [bumpLayoutRevision],
  );
  const refreshWorkspaceLayout = useCallback((): void => {
    bumpLayoutRevision();
  }, [bumpLayoutRevision]);
  const pushEditorHistorySnapshot = useCallback((previousSnapshot: TemplateEditorHistorySnapshot): void => {
    setHistory((currentHistory) => {
      const nextHistory = pushEditorHistoryEntry({ history: currentHistory, previousSnapshot });
      return nextHistory === currentHistory ? currentHistory : nextHistory;
    });
  }, []);
  const commitWorkspaceLayout = useCallback(
    (
      nextLayout: WorkspaceLayoutSnapshot,
      options: { readonly previousLayout?: WorkspaceLayoutSnapshot | null; readonly recordHistory?: boolean } = {},
    ): void => {
      const recordHistory = options.recordHistory !== false;
      const previousLayout = options.previousLayout ?? readWorkspaceLayout(templateRef.current.id);
      if (areWorkspaceLayoutsEqual(previousLayout, nextLayout)) {
        return;
      }
      if (recordHistory) {
        pushEditorHistorySnapshot({ template: templateRef.current, layout: previousLayout });
      }
      writeWorkspaceLayout(templateRef.current.id, nextLayout);
      bumpLayoutRevision();
    },
    [bumpLayoutRevision, pushEditorHistorySnapshot],
  );
  const updateTemplate = useCallback(
    (
      updater: (template: DiagnosticTemplateValue) => DiagnosticTemplateValue,
      options: { readonly shouldReindex?: boolean; readonly recordHistory?: boolean } = {},
    ): void => {
      const recordHistory = options.recordHistory !== false;
      let historySnapshot: TemplateEditorHistorySnapshot | null = null;
      flushSync(() => {
        setTemplate((previous) => {
          const next = updateTemplateWithReindex(previous, updater, options.shouldReindex !== false);
          if (buildTemplatePatchBody(previous) === buildTemplatePatchBody(next)) {
            return previous;
          }
          if (recordHistory) {
            historySnapshot = { template: previous, layout: readWorkspaceLayout(previous.id) };
          }
          return next;
        });
      });
      if (historySnapshot !== null) {
        pushEditorHistorySnapshot(historySnapshot);
      }
    },
    [pushEditorHistorySnapshot],
  );
  const executeUndo = useCallback((): void => {
    const currentSnapshot = readCurrentEditorSnapshot();
    const undoState = buildUndoHistoryState({ history: historyRef.current, currentSnapshot });
    if (undoState === null) {
      return;
    }
    setHistory(undoState.history);
    setTemplate(undoState.snapshot.template);
    restoreWorkspaceLayout(undoState.snapshot.layout);
  }, [readCurrentEditorSnapshot, restoreWorkspaceLayout]);
  const executeRedo = useCallback((): void => {
    const currentSnapshot = readCurrentEditorSnapshot();
    const redoState = buildRedoHistoryState({ history: historyRef.current, currentSnapshot });
    if (redoState === null) {
      return;
    }
    setHistory(redoState.history);
    setTemplate(redoState.snapshot.template);
    restoreWorkspaceLayout(redoState.snapshot.layout);
  }, [readCurrentEditorSnapshot, restoreWorkspaceLayout]);
  const replaceTemplate = useCallback((nextTemplate: DiagnosticTemplateValue): void => {
    setTemplate(nextTemplate);
    setSavedPatchBody(buildTemplatePatchBody(nextTemplate));
    setHistory(createEmptyTemplateHistoryState());
    bumpLayoutRevision();
  }, [bumpLayoutRevision]);
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
      layoutRevision,
      hasUnsavedChanges,
      isSaving,
      canUndo,
      canRedo,
      selection,
      setSelection,
      updateTemplate,
      commitWorkspaceLayout,
      refreshWorkspaceLayout,
      pushEditorHistorySnapshot,
      executeUndo,
      executeRedo,
      executeSave,
      replaceTemplate,
    }),
    [
      canRedo,
      canUndo,
      commitWorkspaceLayout,
      executeRedo,
      executeSave,
      executeUndo,
      hasUnsavedChanges,
      isSaving,
      layoutRevision,
      pushEditorHistorySnapshot,
      refreshWorkspaceLayout,
      replaceTemplate,
      selection,
      setSelection,
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
