import type { WorkspaceLayoutSnapshot } from '@/components/admin/diagnostic-template-editor/workspace-layout-storage';
import type { DiagnosticTemplateValue } from '@/lib/diagnostic-template-types';

export const TEMPLATE_EDITOR_HISTORY_LIMIT = 50;

export type TemplateEditorHistoryState = {
  readonly past: readonly string[];
  readonly future: readonly string[];
};

export type TemplateEditorHistorySnapshot = {
  readonly template: DiagnosticTemplateValue;
  readonly layout: WorkspaceLayoutSnapshot | null;
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

export function serializeEditorHistorySnapshot(snapshot: TemplateEditorHistorySnapshot): string {
  return JSON.stringify(snapshot);
}

export function deserializeEditorHistorySnapshot(serialized: string): TemplateEditorHistorySnapshot {
  const parsed = JSON.parse(serialized) as TemplateEditorHistorySnapshot | DiagnosticTemplateValue;
  if (typeof parsed === 'object' && parsed !== null && 'template' in parsed) {
    return parsed as TemplateEditorHistorySnapshot;
  }
  return { template: parsed as DiagnosticTemplateValue, layout: null };
}

export function areWorkspaceLayoutsEqual(
  left: WorkspaceLayoutSnapshot | null,
  right: WorkspaceLayoutSnapshot | null,
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function pushEditorHistoryEntry(params: {
  readonly history: TemplateEditorHistoryState;
  readonly previousSnapshot: TemplateEditorHistorySnapshot;
}): TemplateEditorHistoryState {
  const snapshot = serializeEditorHistorySnapshot(params.previousSnapshot);
  const lastPastEntry = params.history.past[params.history.past.length - 1];
  if (lastPastEntry === snapshot) {
    return params.history;
  }
  const nextPast = [...params.history.past, snapshot].slice(-TEMPLATE_EDITOR_HISTORY_LIMIT);
  return { past: nextPast, future: [] };
}

export function buildUndoHistoryState(params: {
  readonly history: TemplateEditorHistoryState;
  readonly currentSnapshot: TemplateEditorHistorySnapshot;
}): { readonly history: TemplateEditorHistoryState; readonly snapshot: TemplateEditorHistorySnapshot } | null {
  if (params.history.past.length === 0) {
    return null;
  }
  const previousSerialized = params.history.past[params.history.past.length - 1]!;
  const currentSerialized = serializeEditorHistorySnapshot(params.currentSnapshot);
  return {
    snapshot: deserializeEditorHistorySnapshot(previousSerialized),
    history: {
      past: params.history.past.slice(0, -1),
      future: [currentSerialized, ...params.history.future],
    },
  };
}

export function buildRedoHistoryState(params: {
  readonly history: TemplateEditorHistoryState;
  readonly currentSnapshot: TemplateEditorHistorySnapshot;
}): { readonly history: TemplateEditorHistoryState; readonly snapshot: TemplateEditorHistorySnapshot } | null {
  if (params.history.future.length === 0) {
    return null;
  }
  const nextSerialized = params.history.future[0]!;
  const currentSerialized = serializeEditorHistorySnapshot(params.currentSnapshot);
  return {
    snapshot: deserializeEditorHistorySnapshot(nextSerialized),
    history: {
      past: [...params.history.past, currentSerialized],
      future: params.history.future.slice(1),
    },
  };
}
