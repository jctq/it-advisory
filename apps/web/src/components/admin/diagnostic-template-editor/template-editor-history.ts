import type { DiagnosticTemplateValue } from '@/lib/diagnostic-template-types';

export const TEMPLATE_EDITOR_HISTORY_LIMIT = 50;

export type TemplateEditorHistoryState = {
  readonly past: readonly string[];
  readonly future: readonly string[];
};

export function createEmptyTemplateHistoryState(): TemplateEditorHistoryState {
  return { past: [], future: [] };
}

export function serializeTemplateSnapshot(template: DiagnosticTemplateValue): string {
  return JSON.stringify(template);
}

export function deserializeTemplateSnapshot(snapshot: string): DiagnosticTemplateValue {
  return JSON.parse(snapshot) as DiagnosticTemplateValue;
}

export function pushTemplateHistoryEntry(params: {
  readonly history: TemplateEditorHistoryState;
  readonly previousTemplate: DiagnosticTemplateValue;
}): TemplateEditorHistoryState {
  const snapshot = serializeTemplateSnapshot(params.previousTemplate);
  const lastPastEntry = params.history.past[params.history.past.length - 1];
  if (lastPastEntry === snapshot) {
    return { past: params.history.past, future: [] };
  }
  const nextPast = [...params.history.past, snapshot].slice(-TEMPLATE_EDITOR_HISTORY_LIMIT);
  return { past: nextPast, future: [] };
}

export function buildUndoHistoryState(params: {
  readonly history: TemplateEditorHistoryState;
  readonly currentTemplate: DiagnosticTemplateValue;
}): { readonly history: TemplateEditorHistoryState; readonly template: DiagnosticTemplateValue } | null {
  if (params.history.past.length === 0) {
    return null;
  }
  const previousSnapshot = params.history.past[params.history.past.length - 1]!;
  const currentSnapshot = serializeTemplateSnapshot(params.currentTemplate);
  return {
    template: deserializeTemplateSnapshot(previousSnapshot),
    history: {
      past: params.history.past.slice(0, -1),
      future: [currentSnapshot, ...params.history.future],
    },
  };
}

export function buildRedoHistoryState(params: {
  readonly history: TemplateEditorHistoryState;
  readonly currentTemplate: DiagnosticTemplateValue;
}): { readonly history: TemplateEditorHistoryState; readonly template: DiagnosticTemplateValue } | null {
  if (params.history.future.length === 0) {
    return null;
  }
  const nextSnapshot = params.history.future[0]!;
  const currentSnapshot = serializeTemplateSnapshot(params.currentTemplate);
  return {
    template: deserializeTemplateSnapshot(nextSnapshot),
    history: {
      past: [...params.history.past, currentSnapshot],
      future: params.history.future.slice(1),
    },
  };
}
