import type { Node } from '@xyflow/react';
import type { WorkspaceNodeData } from '@/components/admin/diagnostic-template-editor/build-workspace-graph';
import {
  clampRoundChildPosition,
  ROUND_DEFAULT_MIN_HEIGHT,
  ROUND_DEFAULT_WIDTH,
} from '@/components/admin/diagnostic-template-editor/workspace-layout-constants';

/** Rendered above rounds (0), cards (10), and edges while dragging. */
export const WORKSPACE_DRAGGING_Z_INDEX = 1000;

export type FlowPosition = {
  readonly x: number;
  readonly y: number;
};

function readNodeDimension(value: number | string | undefined): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return 0;
}

function readRoundNodeWidth(roundNode: Node<WorkspaceNodeData>): number {
  const fromStyle = readNodeDimension(roundNode.style?.width);
  if (fromStyle > 0) {
    return fromStyle;
  }
  const fromNode = readNodeDimension(roundNode.width);
  return fromNode > 0 ? fromNode : ROUND_DEFAULT_WIDTH;
}

function readRoundNodeHeight(roundNode: Node<WorkspaceNodeData>): number {
  const fromStyle = readNodeDimension(roundNode.style?.height);
  if (fromStyle > 0) {
    return fromStyle;
  }
  const fromNode = readNodeDimension(roundNode.height);
  return fromNode > 0 ? fromNode : ROUND_DEFAULT_MIN_HEIGHT;
}

/** Returns the round whose bounds contain the flow position (topmost match wins). */
export function resolveRoundIdAtFlowPosition(params: {
  readonly flowPosition: FlowPosition;
  readonly roundNodes: readonly Node<WorkspaceNodeData>[];
}): string | null {
  let targetRoundId: string | null = null;
  for (const roundNode of params.roundNodes) {
    if (roundNode.data.kind !== 'round' || roundNode.data.roundId === undefined) {
      continue;
    }
    const width = readRoundNodeWidth(roundNode);
    const height = readRoundNodeHeight(roundNode);
    const withinX =
      params.flowPosition.x >= roundNode.position.x &&
      params.flowPosition.x <= roundNode.position.x + width;
    const withinY =
      params.flowPosition.y >= roundNode.position.y &&
      params.flowPosition.y <= roundNode.position.y + height;
    if (withinX && withinY) {
      targetRoundId = roundNode.data.roundId;
    }
  }
  return targetRoundId;
}

export function toAbsoluteFlowPosition(
  node: Node<WorkspaceNodeData>,
  nodes: readonly Node<WorkspaceNodeData>[],
): FlowPosition {
  if (node.parentId === undefined) {
    return node.position;
  }
  const parentNode = nodes.find((candidate) => candidate.id === node.parentId);
  if (parentNode === undefined) {
    return node.position;
  }
  return {
    x: parentNode.position.x + node.position.x,
    y: parentNode.position.y + node.position.y,
  };
}

/** Lifts a question out of its round so it can be dragged across the canvas. */
export function detachQuestionNodeForDrag(
  node: Node<WorkspaceNodeData>,
  nodes: readonly Node<WorkspaceNodeData>[],
): Node<WorkspaceNodeData> {
  return {
    ...node,
    position: toAbsoluteFlowPosition(node, nodes),
    parentId: undefined,
    extent: undefined,
    zIndex: WORKSPACE_DRAGGING_Z_INDEX,
  };
}

export function elevateNodeForDrag(node: Node<WorkspaceNodeData>): Node<WorkspaceNodeData> {
  return {
    ...node,
    zIndex: WORKSPACE_DRAGGING_Z_INDEX,
  };
}

/** Re-attaches a question under its round using flow-absolute coordinates from dragging. */
export function reattachQuestionNodeToRound(params: {
  readonly node: Node<WorkspaceNodeData>;
  readonly roundNode: Node<WorkspaceNodeData>;
}): Node<WorkspaceNodeData> {
  return {
    ...params.node,
    parentId: params.roundNode.id,
    extent: 'parent',
    position: clampRoundChildPosition({
      x: params.node.position.x - params.roundNode.position.x,
      y: params.node.position.y - params.roundNode.position.y,
    }),
    zIndex: 10,
  };
}

/** Re-attaches a question when its position is already relative to the round. */
export function reattachQuestionNodeAtRelativePosition(params: {
  readonly node: Node<WorkspaceNodeData>;
  readonly roundNode: Node<WorkspaceNodeData>;
  readonly relativePosition: FlowPosition;
}): Node<WorkspaceNodeData> {
  return {
    ...params.node,
    parentId: params.roundNode.id,
    extent: 'parent',
    position: clampRoundChildPosition(params.relativePosition),
    zIndex: 10,
  };
}
