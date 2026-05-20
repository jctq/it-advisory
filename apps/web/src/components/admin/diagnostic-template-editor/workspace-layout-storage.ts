import type { WorkspaceStructuralConnectionOrientation } from '@/components/admin/diagnostic-template-editor/workspace-connection-orientation';

export type WorkspaceNodeLayoutEntry = {
  readonly x: number;
  readonly y: number;
  readonly width?: number;
  readonly height?: number;
  /** When true, width/height were set manually and should not be auto-calculated. */
  readonly userSized?: boolean;
};

/** @deprecated Use WorkspaceNodeLayoutEntry */
export type WorkspaceNodePosition = WorkspaceNodeLayoutEntry;

export type WorkspaceLayoutSnapshot = {
  readonly nodes: Readonly<Record<string, WorkspaceNodeLayoutEntry>>;
};

const LAYOUT_STORAGE_KEY_PREFIX = 'diagnostic-template-workspace-layout';

function buildLayoutStorageKey(templateId: string): string {
  return `${LAYOUT_STORAGE_KEY_PREFIX}:${templateId}`;
}

export function readWorkspaceLayout(templateId: string): WorkspaceLayoutSnapshot | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(buildLayoutStorageKey(templateId));
    if (raw === null) {
      return null;
    }
    const parsed = JSON.parse(raw) as WorkspaceLayoutSnapshot;
    if (typeof parsed !== 'object' || parsed === null || typeof parsed.nodes !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeWorkspaceLayout(templateId: string, layout: WorkspaceLayoutSnapshot): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(buildLayoutStorageKey(templateId), JSON.stringify(layout));
}

export const WORKSPACE_SNAP_SETTINGS_STORAGE_KEY = 'diagnostic-template-workspace-snap-settings';

export type WorkspaceSnapSettings = {
  readonly gridSnap: boolean;
  readonly alignmentSnap: boolean;
  readonly structuralConnectionOrientation: WorkspaceStructuralConnectionOrientation;
};

export const DEFAULT_WORKSPACE_SNAP_SETTINGS: WorkspaceSnapSettings = {
  gridSnap: true,
  alignmentSnap: true,
  structuralConnectionOrientation: 'auto',
};

export function readWorkspaceSnapSettings(): WorkspaceSnapSettings {
  if (typeof window === 'undefined') {
    return DEFAULT_WORKSPACE_SNAP_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(WORKSPACE_SNAP_SETTINGS_STORAGE_KEY);
    if (raw === null) {
      return DEFAULT_WORKSPACE_SNAP_SETTINGS;
    }
    const parsed = JSON.parse(raw) as WorkspaceSnapSettings;
    const orientation = parsed.structuralConnectionOrientation;
    return {
      gridSnap: parsed.gridSnap !== false,
      alignmentSnap: parsed.alignmentSnap !== false,
      structuralConnectionOrientation:
        orientation === 'vertical' || orientation === 'horizontal' || orientation === 'auto'
          ? orientation
          : 'auto',
    };
  } catch {
    return DEFAULT_WORKSPACE_SNAP_SETTINGS;
  }
}

export function clearWorkspaceLayout(templateId: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(buildLayoutStorageKey(templateId));
}

export function pruneWorkspaceLayoutNodeIds(templateId: string, removedNodeIds: readonly string[]): void {
  if (typeof window === 'undefined' || removedNodeIds.length === 0) {
    return;
  }
  const layout = readWorkspaceLayout(templateId);
  if (layout === null) {
    return;
  }
  const removeSet = new Set(removedNodeIds);
  const nextNodes = Object.fromEntries(
    Object.entries(layout.nodes).filter(([nodeId]) => !removeSet.has(nodeId)),
  );
  writeWorkspaceLayout(templateId, { nodes: nextNodes });
}

export function writeWorkspaceSnapSettings(settings: WorkspaceSnapSettings): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(WORKSPACE_SNAP_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

export const EDITOR_VIEW_STORAGE_KEY = 'diagnostic-template-editor-view';

export type DiagnosticTemplateEditorView = 'classic' | 'workspace';

export function readPersistedEditorView(): DiagnosticTemplateEditorView {
  if (typeof window === 'undefined') {
    return 'classic';
  }
  const value = window.localStorage.getItem(EDITOR_VIEW_STORAGE_KEY);
  return value === 'workspace' ? 'workspace' : 'classic';
}

export function writePersistedEditorView(view: DiagnosticTemplateEditorView): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.setItem(EDITOR_VIEW_STORAGE_KEY, view);
}
