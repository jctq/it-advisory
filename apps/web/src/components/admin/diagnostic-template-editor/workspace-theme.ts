import type { CSSProperties } from 'react';
import type { Edge } from '@xyflow/react';
import type { WorkspaceEdgeData, WorkspaceEdgeKind } from '@/components/admin/diagnostic-template-editor/build-workspace-graph';

export const WORKSPACE_CANVAS_CLASS = 'bg-muted/50 dark:bg-background';

export const WORKSPACE_PANEL_CLASS = 'border-border bg-muted/40 dark:bg-background';

export const WORKSPACE_CHROME_SHELL_CLASS =
  'border-border bg-card/95 shadow-lg backdrop-blur-sm';

export const WORKSPACE_CHROME_DIVIDER_CLASS = 'bg-border';

export const WORKSPACE_CHROME_MUTED_TEXT_CLASS = 'text-muted-foreground';

export const WORKSPACE_CHROME_TEXT_CLASS = 'text-foreground';

export const WORKSPACE_CHROME_BUTTON_CLASS =
  'text-muted-foreground hover:bg-muted hover:text-foreground';

export const WORKSPACE_CHROME_ACTIVE_VIOLET_CLASS = 'bg-violet-500/15 text-violet-700 dark:text-violet-200';

export const WORKSPACE_CHROME_ACTIVE_SKY_CLASS = 'bg-sky-500/15 text-sky-700 dark:text-sky-200';

export const WORKSPACE_CHROME_INPUT_CLASS =
  'border-0 bg-transparent text-foreground shadow-none placeholder:text-muted-foreground focus-visible:ring-0';

export const WORKSPACE_CHROME_OUTLINE_BUTTON_CLASS =
  'border-border bg-card text-foreground hover:bg-muted disabled:opacity-40';

export const WORKSPACE_ROUND_NODE_CLASS =
  'flex h-full w-full flex-col overflow-hidden rounded-2xl border border-border bg-card/95 shadow-lg backdrop-blur-sm dark:bg-card/60';

export const WORKSPACE_ROUND_NODE_HEADER_CLASS =
  'flex shrink-0 flex-col justify-center gap-0.5 overflow-hidden border-b border-border px-4 py-2';

export const WORKSPACE_CARD_NODE_CLASS =
  'flex h-full w-full flex-col gap-1 overflow-hidden rounded-xl border border-border bg-card px-3 py-2 shadow-md';

export const WORKSPACE_NODE_SELECTED_RING_CLASS = 'ring-2 ring-primary/80';

export const WORKSPACE_NODE_KIND_LABEL_CLASS = 'text-[10px] font-semibold uppercase tracking-wide text-muted-foreground';

export const WORKSPACE_NODE_TITLE_CLASS = 'text-foreground';

export const WORKSPACE_NODE_SUBTITLE_CLASS =
  'rounded-md bg-violet-500/10 px-1.5 py-0.5 text-[10px] font-medium leading-none text-violet-700 dark:text-violet-300';

export const WORKSPACE_FLOW_CONTROLS_CLASS =
  '!rounded-lg !border-border !bg-card/95 !shadow-lg [&>button]:!border-border [&>button]:!bg-muted [&>button]:!text-foreground';

export const WORKSPACE_MINIMAP_CLASS = '!rounded-lg !border-border !bg-card/90';

export const WORKSPACE_TOOLTIP_CLASS = 'border-border bg-popover text-popover-foreground';

export const WORKSPACE_INSPECTOR_SURFACE_CLASS = 'rounded-xl border border-border bg-card/60 px-3 py-3';

export const WORKSPACE_INSPECTOR_INPUT_CLASS =
  'border-input bg-background text-foreground dark:bg-input/30';

export const WORKSPACE_INSPECTOR_SELECT_CLASS =
  'flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground dark:bg-input/30';

export const WORKSPACE_INSPECTOR_OUTLINE_BUTTON_CLASS = 'border-border text-foreground';

export const WORKSPACE_VISIBILITY_RULE_SELECTED_CLASS =
  'border-primary bg-primary/15 text-primary';

export const WORKSPACE_VISIBILITY_RULE_IDLE_CLASS = 'border-border text-muted-foreground';

type WorkspaceEdgeColorSet = {
  readonly sequential: string;
  readonly owns: string;
  readonly child: string;
  readonly conditional: string;
};

const WORKSPACE_EDGE_COLORS: { readonly light: WorkspaceEdgeColorSet; readonly dark: WorkspaceEdgeColorSet } = {
  light: {
    sequential: '#64748b',
    owns: '#6d28d9',
    child: '#475569',
    conditional: '#0369a1',
  },
  dark: {
    sequential: '#64748b',
    owns: '#a78bfa',
    child: '#94a3b8',
    conditional: '#38bdf8',
  },
};

const WORKSPACE_CANVAS_DOT_COLORS = {
  light: '#cbd5e1',
  dark: '#334155',
} as const;

const WORKSPACE_GUIDE_STROKE_COLORS = {
  light: '#0369a1',
  dark: '#38bdf8',
} as const;

const WORKSPACE_MINIMAP_NODE_COLORS = {
  light: {
    round: '#0284c7',
    question: '#0369a1',
    default: '#64748b',
  },
  dark: {
    round: '#0ea5e9',
    question: '#38bdf8',
    default: '#64748b',
  },
} as const;

export function readWorkspaceIsDarkFromDocument(): boolean {
  if (typeof document === 'undefined') {
    return false;
  }
  return document.documentElement.classList.contains('dark');
}

export function readWorkspaceEdgeColors(isDark: boolean): WorkspaceEdgeColorSet {
  return isDark ? WORKSPACE_EDGE_COLORS.dark : WORKSPACE_EDGE_COLORS.light;
}

export function readWorkspaceEdgeStrokeStyle(
  kind: WorkspaceEdgeKind,
  isDark: boolean,
): CSSProperties {
  const colors = readWorkspaceEdgeColors(isDark);
  if (kind === 'sequential') {
    return { stroke: colors.sequential, strokeDasharray: '6 4', strokeWidth: 1.5 };
  }
  if (kind === 'owns') {
    return { stroke: colors.owns, strokeWidth: 2 };
  }
  if (kind === 'child') {
    return { stroke: colors.child, strokeWidth: 2 };
  }
  return { stroke: colors.conditional, strokeWidth: 2 };
}

export function readWorkspaceRoundSequenceEdgeStyle(isDark: boolean): CSSProperties {
  const colors = readWorkspaceEdgeColors(isDark);
  return { stroke: colors.sequential, strokeDasharray: '8 6', strokeWidth: 1.5 };
}

export function applyWorkspaceEdgeTheme(
  edges: readonly Edge<WorkspaceEdgeData>[],
  isDark: boolean,
): Edge<WorkspaceEdgeData>[] {
  return edges.map((edge) => {
    const kind = edge.data?.kind;
    if (kind === undefined) {
      return edge;
    }
    const baseStyle =
      kind === 'sequential' && edge.id.startsWith('round-seq:')
        ? readWorkspaceRoundSequenceEdgeStyle(isDark)
        : readWorkspaceEdgeStrokeStyle(kind, isDark);
    return {
      ...edge,
      style: {
        ...edge.style,
        ...baseStyle,
      },
    };
  });
}

export function readWorkspaceCanvasDotColor(isDark: boolean): string {
  return isDark ? WORKSPACE_CANVAS_DOT_COLORS.dark : WORKSPACE_CANVAS_DOT_COLORS.light;
}

export function readWorkspaceGuideStrokeColor(isDark: boolean): string {
  return isDark ? WORKSPACE_GUIDE_STROKE_COLORS.dark : WORKSPACE_GUIDE_STROKE_COLORS.light;
}

export function readWorkspaceMinimapNodeColor(
  kind: 'round' | 'question' | 'default',
  isDark: boolean,
): string {
  const palette = isDark ? WORKSPACE_MINIMAP_NODE_COLORS.dark : WORKSPACE_MINIMAP_NODE_COLORS.light;
  return palette[kind];
}

export const WORKSPACE_EDGE_LEGEND_ITEMS: readonly {
  readonly kind: WorkspaceEdgeKind | 'roundSequential';
  readonly label: string;
  readonly dashed: boolean;
}[] = [
  { kind: 'owns', label: 'Question → options', dashed: false },
  { kind: 'conditional', label: 'Visibility', dashed: false },
  { kind: 'roundSequential', label: 'Flow order', dashed: true },
  { kind: 'child', label: 'Follow-up', dashed: false },
];

export function readWorkspaceLegendSwatchColor(
  kind: WorkspaceEdgeKind | 'roundSequential',
  isDark: boolean,
): string {
  const colors = readWorkspaceEdgeColors(isDark);
  if (kind === 'roundSequential' || kind === 'sequential') {
    return colors.sequential;
  }
  if (kind === 'owns') {
    return colors.owns;
  }
  if (kind === 'child') {
    return colors.child;
  }
  return colors.conditional;
}
