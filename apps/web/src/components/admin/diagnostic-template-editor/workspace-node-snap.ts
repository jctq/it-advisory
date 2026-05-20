import type { Node } from '@xyflow/react';
import type { WorkspaceNodeData } from '@/components/admin/diagnostic-template-editor/build-workspace-graph';

export const WORKSPACE_SNAP_GRID_SIZE = 20;

export const WORKSPACE_ALIGNMENT_SNAP_THRESHOLD = 8;

export type SnapGuideLines = {
  readonly horizontal: number | null;
  readonly vertical: number | null;
};

type NodeBounds = {
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly centerX: number;
  readonly centerY: number;
};

type SnapCandidate = {
  readonly axis: 'x' | 'y';
  readonly value: number;
  readonly guide: number;
  readonly distance: number;
};

function readNodeDimension(value: number | string | undefined): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function readNodeSize(node: Node<WorkspaceNodeData>): { readonly width: number; readonly height: number } {
  const width =
    readNodeDimension(node.width) ??
    readNodeDimension(node.style?.width) ??
    readNodeDimension(node.measured?.width) ??
    168;
  const height =
    readNodeDimension(node.height) ??
    readNodeDimension(node.style?.height) ??
    readNodeDimension(node.measured?.height) ??
    56;
  return { width, height };
}

function buildBounds(position: { readonly x: number; readonly y: number }, size: { readonly width: number; readonly height: number }): NodeBounds {
  return {
    left: position.x,
    right: position.x + size.width,
    top: position.y,
    bottom: position.y + size.height,
    centerX: position.x + size.width / 2,
    centerY: position.y + size.height / 2,
  };
}

function snapValueToGrid(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}

function collectSnapCandidates(params: {
  readonly dragged: NodeBounds;
  readonly target: NodeBounds;
  readonly threshold: number;
}): readonly SnapCandidate[] {
  const candidates: SnapCandidate[] = [];
  const xPairs: readonly { readonly dragged: number; readonly target: number }[] = [
    { dragged: params.dragged.left, target: params.target.left },
    { dragged: params.dragged.right, target: params.target.right },
    { dragged: params.dragged.centerX, target: params.target.centerX },
    { dragged: params.dragged.left, target: params.target.right },
    { dragged: params.dragged.right, target: params.target.left },
  ];
  for (const pair of xPairs) {
    const distance = Math.abs(pair.dragged - pair.target);
    if (distance <= params.threshold) {
      candidates.push({
        axis: 'x',
        value: pair.target - pair.dragged,
        guide: pair.target,
        distance,
      });
    }
  }
  const yPairs: readonly { readonly dragged: number; readonly target: number }[] = [
    { dragged: params.dragged.top, target: params.target.top },
    { dragged: params.dragged.bottom, target: params.target.bottom },
    { dragged: params.dragged.centerY, target: params.target.centerY },
    { dragged: params.dragged.top, target: params.target.bottom },
    { dragged: params.dragged.bottom, target: params.target.top },
  ];
  for (const pair of yPairs) {
    const distance = Math.abs(pair.dragged - pair.target);
    if (distance <= params.threshold) {
      candidates.push({
        axis: 'y',
        value: pair.target - pair.dragged,
        guide: pair.target,
        distance,
      });
    }
  }
  return candidates;
}

function pickBestCandidate(candidates: readonly SnapCandidate[], axis: 'x' | 'y'): SnapCandidate | null {
  const axisCandidates = candidates.filter((candidate) => candidate.axis === axis);
  if (axisCandidates.length === 0) {
    return null;
  }
  return axisCandidates.reduce((best, candidate) => (candidate.distance < best.distance ? candidate : best));
}

export function snapWorkspaceNodePosition(params: {
  readonly node: Node<WorkspaceNodeData>;
  readonly position: { readonly x: number; readonly y: number };
  readonly nodes: readonly Node<WorkspaceNodeData>[];
  readonly enableGridSnap: boolean;
  readonly enableAlignmentSnap: boolean;
  readonly gridSize?: number;
  readonly threshold?: number;
}): { readonly position: { readonly x: number; readonly y: number }; readonly guides: SnapGuideLines } {
  const gridSize = params.gridSize ?? WORKSPACE_SNAP_GRID_SIZE;
  const threshold = params.threshold ?? WORKSPACE_ALIGNMENT_SNAP_THRESHOLD;
  const size = readNodeSize(params.node);
  let nextX = params.position.x;
  let nextY = params.position.y;
  let verticalGuide: number | null = null;
  let horizontalGuide: number | null = null;
  if (params.enableAlignmentSnap) {
    const draggedBounds = buildBounds({ x: nextX, y: nextY }, size);
    const candidates: SnapCandidate[] = [];
    for (const otherNode of params.nodes) {
      if (otherNode.id === params.node.id) {
        continue;
      }
      if (otherNode.parentId !== params.node.parentId) {
        continue;
      }
      const otherSize = readNodeSize(otherNode);
      const otherBounds = buildBounds(otherNode.position, otherSize);
      candidates.push(
        ...collectSnapCandidates({
          dragged: draggedBounds,
          target: otherBounds,
          threshold,
        }),
      );
    }
    const bestX = pickBestCandidate(candidates, 'x');
    const bestY = pickBestCandidate(candidates, 'y');
    if (bestX !== null) {
      nextX += bestX.value;
      verticalGuide = bestX.guide;
    }
    if (bestY !== null) {
      nextY += bestY.value;
      horizontalGuide = bestY.guide;
    }
  }
  if (params.enableGridSnap) {
    if (verticalGuide === null) {
      nextX = snapValueToGrid(nextX, gridSize);
    }
    if (horizontalGuide === null) {
      nextY = snapValueToGrid(nextY, gridSize);
    }
  }
  return {
    position: { x: nextX, y: nextY },
    guides: {
      horizontal: horizontalGuide,
      vertical: verticalGuide,
    },
  };
}
