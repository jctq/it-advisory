'use client';

import { Handle, NodeResizer, Position, type NodeProps } from '@xyflow/react';
import type { ReactElement } from 'react';
import {
  VISIBILITY_SOURCE_HANDLE_ID,
  VISIBILITY_TARGET_HANDLE_ID,
  type WorkspaceNodeData,
} from '@/components/admin/diagnostic-template-editor/build-workspace-graph';
import { useWorkspaceCanvasSettings } from '@/components/admin/diagnostic-template-editor/workspace-canvas-settings-context';
import {
  CHILD_SOURCE_HORIZONTAL_HANDLE_ID,
  CHILD_SOURCE_VERTICAL_HANDLE_ID,
  CHILD_TARGET_HORIZONTAL_HANDLE_ID,
  CHILD_TARGET_VERTICAL_HANDLE_ID,
  OWNS_SOURCE_HORIZONTAL_HANDLE_ID,
  OWNS_SOURCE_VERTICAL_HANDLE_ID,
  OWNS_TARGET_HORIZONTAL_HANDLE_ID,
  OWNS_TARGET_VERTICAL_HANDLE_ID,
} from '@/components/admin/diagnostic-template-editor/workspace-connection-orientation';
import {
  CARD_MIN_HEIGHT,
  CARD_MIN_WIDTH,
  ROUND_HEADER_HEIGHT,
  ROUND_MIN_HEIGHT,
  ROUND_MIN_WIDTH,
} from '@/components/admin/diagnostic-template-editor/workspace-layout-constants';
import {
  WORKSPACE_CARD_NODE_CLASS,
  WORKSPACE_NODE_KIND_LABEL_CLASS,
  WORKSPACE_NODE_SELECTED_RING_CLASS,
  WORKSPACE_NODE_SUBTITLE_CLASS,
  WORKSPACE_NODE_TITLE_CLASS,
  WORKSPACE_ROUND_NODE_CLASS,
  WORKSPACE_ROUND_NODE_HEADER_CLASS,
} from '@/components/admin/diagnostic-template-editor/workspace-theme';
import { WorkspaceTooltip } from '@/components/admin/diagnostic-template-editor/workspace-tooltip';
import { cn } from '@/lib/utils';

const RESIZER_LINE_CLASS = '!border-sky-500/80';
const RESIZER_HANDLE_CLASS = '!h-2.5 !w-2.5 !rounded-sm !border !border-sky-300 !bg-sky-400';

const VISIBILITY_HANDLE_CLASS = '!h-2.5 !w-2.5 !border-sky-400 !bg-sky-500';
const OWNS_HANDLE_CLASS = '!h-3 !w-3 !border-violet-400 !bg-violet-500';
const OWNS_HANDLE_MUTED_CLASS = '!h-2 !w-2 !border-violet-500/50 !bg-violet-500/40';
const CHILD_HANDLE_CLASS = '!h-2.5 !w-2.5 !border-slate-400 !bg-slate-500';
const CHILD_HANDLE_MUTED_CLASS = '!h-2 !w-2 !border-slate-500/50 !bg-slate-500/40';

const VISIBILITY_SIDE_STYLE = { top: '38%' } as const;
const OWNS_HORIZONTAL_SOURCE_STYLE = { top: '72%' } as const;
const OWNS_HORIZONTAL_TARGET_STYLE = { top: '50%' } as const;
const CHILD_HORIZONTAL_SOURCE_STYLE = { top: '72%' } as const;
const CHILD_HORIZONTAL_TARGET_STYLE = { top: '50%' } as const;

type WorkspaceNodeResizerProps = {
  readonly isVisible: boolean;
  readonly minWidth: number;
  readonly minHeight: number;
};

function WorkspaceNodeResizer(props: WorkspaceNodeResizerProps): ReactElement {
  return (
    <NodeResizer
      minWidth={props.minWidth}
      minHeight={props.minHeight}
      isVisible={props.isVisible}
      lineClassName={RESIZER_LINE_CLASS}
      handleClassName={RESIZER_HANDLE_CLASS}
    />
  );
}

function VisibilityHandles(): ReactElement {
  return (
    <>
      <Handle
        id={VISIBILITY_TARGET_HANDLE_ID}
        type="target"
        position={Position.Left}
        style={VISIBILITY_SIDE_STYLE}
        className={VISIBILITY_HANDLE_CLASS}
        title="Visibility target"
      />
      <Handle
        id={VISIBILITY_SOURCE_HANDLE_ID}
        type="source"
        position={Position.Right}
        style={VISIBILITY_SIDE_STYLE}
        className={VISIBILITY_HANDLE_CLASS}
        title="Visibility source (drag to set show-when)"
      />
    </>
  );
}

type StructuralHandlesProps = {
  readonly showVertical: boolean;
  readonly showHorizontal: boolean;
  readonly showOwnsSource: boolean;
  readonly showOwnsTarget: boolean;
  readonly showChildSource: boolean;
  readonly showChildTarget: boolean;
};

function StructuralHandles(props: StructuralHandlesProps): ReactElement | null {
  const hasHandles =
    props.showOwnsSource ||
    props.showOwnsTarget ||
    props.showChildSource ||
    props.showChildTarget;
  if (!hasHandles) {
    return null;
  }
  const ownsVerticalClass = props.showVertical ? OWNS_HANDLE_CLASS : OWNS_HANDLE_MUTED_CLASS;
  const ownsHorizontalClass = props.showHorizontal ? OWNS_HANDLE_CLASS : OWNS_HANDLE_MUTED_CLASS;
  const childVerticalClass = props.showVertical ? CHILD_HANDLE_CLASS : CHILD_HANDLE_MUTED_CLASS;
  const childHorizontalClass = props.showHorizontal ? CHILD_HANDLE_CLASS : CHILD_HANDLE_MUTED_CLASS;
  return (
    <>
      {props.showOwnsTarget && props.showVertical ? (
        <Handle
          id={OWNS_TARGET_VERTICAL_HANDLE_ID}
          type="target"
          position={Position.Top}
          className={ownsVerticalClass}
          title="Belongs to question (vertical)"
        />
      ) : null}
      {props.showOwnsSource && props.showVertical ? (
        <Handle
          id={OWNS_SOURCE_VERTICAL_HANDLE_ID}
          type="source"
          position={Position.Bottom}
          className={ownsVerticalClass}
          title="Options connect here (vertical)"
        />
      ) : null}
      {props.showOwnsTarget && props.showHorizontal ? (
        <Handle
          id={OWNS_TARGET_HORIZONTAL_HANDLE_ID}
          type="target"
          position={Position.Left}
          style={OWNS_HORIZONTAL_TARGET_STYLE}
          className={ownsHorizontalClass}
          title="Belongs to question (horizontal)"
        />
      ) : null}
      {props.showOwnsSource && props.showHorizontal ? (
        <Handle
          id={OWNS_SOURCE_HORIZONTAL_HANDLE_ID}
          type="source"
          position={Position.Right}
          style={OWNS_HORIZONTAL_SOURCE_STYLE}
          className={ownsHorizontalClass}
          title="Options connect here (horizontal)"
        />
      ) : null}
      {props.showChildTarget && props.showVertical ? (
        <Handle
          id={CHILD_TARGET_VERTICAL_HANDLE_ID}
          type="target"
          position={Position.Top}
          className={childVerticalClass}
          title="Follow-up from option (vertical)"
        />
      ) : null}
      {props.showChildSource && props.showVertical ? (
        <Handle
          id={CHILD_SOURCE_VERTICAL_HANDLE_ID}
          type="source"
          position={Position.Bottom}
          className={childVerticalClass}
          title="Follow-up question (vertical)"
        />
      ) : null}
      {props.showChildTarget && props.showHorizontal ? (
        <Handle
          id={CHILD_TARGET_HORIZONTAL_HANDLE_ID}
          type="target"
          position={Position.Left}
          style={CHILD_HORIZONTAL_TARGET_STYLE}
          className={childHorizontalClass}
          title="Follow-up from option (horizontal)"
        />
      ) : null}
      {props.showChildSource && props.showHorizontal ? (
        <Handle
          id={CHILD_SOURCE_HORIZONTAL_HANDLE_ID}
          type="source"
          position={Position.Right}
          style={CHILD_HORIZONTAL_SOURCE_STYLE}
          className={childHorizontalClass}
          title="Follow-up question (horizontal)"
        />
      ) : null}
    </>
  );
}

function buildWorkspaceCardTooltipText(data: WorkspaceNodeData): string {
  if (data.subtitle === undefined || data.subtitle.trim().length === 0) {
    return data.label;
  }
  return `${data.label}\n${data.subtitle}`;
}

type WorkspaceCardBodyProps = {
  readonly data: WorkspaceNodeData;
  readonly kindLabel: string;
};

function WorkspaceCardBody(props: WorkspaceCardBodyProps): ReactElement {
  const titleLineClamp = props.data.kind === 'question' ? 'line-clamp-3' : 'line-clamp-2';
  const body = (
    <div className="flex min-h-0 w-full flex-1 flex-col gap-1 overflow-hidden px-0.5">
      <p className={cn('shrink-0', WORKSPACE_NODE_KIND_LABEL_CLASS)}>{props.kindLabel}</p>
      <p
        className={cn(
          'min-h-0 shrink overflow-hidden text-xs font-medium leading-snug',
          titleLineClamp,
          WORKSPACE_NODE_TITLE_CLASS,
        )}
      >
        {props.data.label}
      </p>
      {props.data.subtitle ? (
        <p className={cn('shrink-0 truncate', WORKSPACE_NODE_SUBTITLE_CLASS)}>{props.data.subtitle}</p>
      ) : null}
    </div>
  );
  const shouldShowTooltip =
    props.data.subtitle !== undefined ||
    props.data.label.length > 36 ||
    props.data.label.trim().includes(' ');
  if (!shouldShowTooltip) {
    return body;
  }
  return (
    <WorkspaceTooltip label={buildWorkspaceCardTooltipText(props.data)} side="top" tone="workspace">
      {body}
    </WorkspaceTooltip>
  );
}

function useStructuralHandleVisibility(): { readonly showVertical: boolean; readonly showHorizontal: boolean } {
  const { structuralConnectionOrientation } = useWorkspaceCanvasSettings();
  if (structuralConnectionOrientation === 'vertical') {
    return { showVertical: true, showHorizontal: false };
  }
  if (structuralConnectionOrientation === 'horizontal') {
    return { showVertical: false, showHorizontal: true };
  }
  return { showVertical: true, showHorizontal: true };
}

export function RoundGroupNode(props: NodeProps): ReactElement {
  const data = props.data as WorkspaceNodeData;
  return (
    <>
      <WorkspaceNodeResizer
        isVisible={props.selected}
        minWidth={ROUND_MIN_WIDTH}
        minHeight={ROUND_MIN_HEIGHT}
      />
      <div className={cn(WORKSPACE_ROUND_NODE_CLASS, props.selected && WORKSPACE_NODE_SELECTED_RING_CLASS)}>
        <Handle
          id={VISIBILITY_TARGET_HANDLE_ID}
          type="target"
          position={Position.Left}
          style={VISIBILITY_SIDE_STYLE}
          className={VISIBILITY_HANDLE_CLASS}
          title="Round visibility target"
        />
        <div className={WORKSPACE_ROUND_NODE_HEADER_CLASS} style={{ height: ROUND_HEADER_HEIGHT }}>
          <p className={cn('line-clamp-1', WORKSPACE_NODE_KIND_LABEL_CLASS)}>Round</p>
          <p className={cn('line-clamp-2 text-sm font-semibold leading-snug', WORKSPACE_NODE_TITLE_CLASS)}>{data.label}</p>
          {data.subtitle ? (
            <p className={cn('line-clamp-1 truncate', WORKSPACE_NODE_KIND_LABEL_CLASS)}>{data.subtitle}</p>
          ) : null}
        </div>
        <div className="min-h-0 flex-1" />
        <Handle
          id={VISIBILITY_SOURCE_HANDLE_ID}
          type="source"
          position={Position.Right}
          style={VISIBILITY_SIDE_STYLE}
          className={VISIBILITY_HANDLE_CLASS}
          title="Next round / visibility source"
        />
      </div>
    </>
  );
}

export function WorkspaceCardNode(props: NodeProps): ReactElement {
  const data = props.data as WorkspaceNodeData;
  const handleVisibility = useStructuralHandleVisibility();
  const kindLabel =
    data.kind === 'question' ? 'Question' : data.kind === 'option' ? 'Option' : 'Follow-up';
  const isQuestion = data.kind === 'question';
  const isOption = data.kind === 'option';
  const isChildQuestion = data.kind === 'childQuestion';
  return (
    <>
      <WorkspaceNodeResizer
        isVisible={props.selected}
        minWidth={CARD_MIN_WIDTH}
        minHeight={CARD_MIN_HEIGHT}
      />
      <div
        className={cn(
          WORKSPACE_CARD_NODE_CLASS,
          isQuestion && 'border-violet-500/40 dark:border-violet-500/30',
          isOption && 'border-violet-500/25 dark:border-violet-500/20',
          props.selected && WORKSPACE_NODE_SELECTED_RING_CLASS,
        )}
      >
        <StructuralHandles
          showVertical={handleVisibility.showVertical}
          showHorizontal={handleVisibility.showHorizontal}
          showOwnsSource={isQuestion}
          showOwnsTarget={isOption}
          showChildSource={isOption}
          showChildTarget={isChildQuestion}
        />
        <VisibilityHandles />
        <WorkspaceCardBody data={data} kindLabel={kindLabel} />
      </div>
    </>
  );
}
