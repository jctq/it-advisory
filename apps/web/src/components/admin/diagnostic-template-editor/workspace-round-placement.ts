import type { Node } from '@xyflow/react';
import {
  buildChildQuestionNodeId,
  buildOptionNodeId,
  buildQuestionNodeId,
  buildRoundNodeId,
} from '@/components/admin/diagnostic-template-editor/build-workspace-graph';
import { readQuestionTypeLabel } from '@/components/admin/diagnostic-template-editor/diagnostic-template-editor-utils';
import {
  buildAutoLayoutForRound,
  estimateCardSize,
  type AutoLayoutPlacedNode,
} from '@/components/admin/diagnostic-template-editor/workspace-auto-layout';
import {
  clampRoundChildPosition,
  ROUND_CONTENT_TOP,
  ROUND_PADDING_X,
  ROUND_PADDING_BOTTOM,
} from '@/components/admin/diagnostic-template-editor/workspace-layout-constants';
import type { FlowPosition } from '@/components/admin/diagnostic-template-editor/workspace-round-hit-test';
import { collectWorkspaceNodeIdsForMovedQuestion } from '@/components/admin/diagnostic-template-editor/workspace-structural-mutations';
import type {
  DiagnosticTemplateRoundValue,
  DiagnosticTemplateValue,
} from '@/lib/diagnostic-template-types';
import type {
  WorkspaceLayoutSnapshot,
  WorkspaceNodeLayoutEntry,
} from '@/components/admin/diagnostic-template-editor/workspace-layout-storage';

const PLACEMENT_GAP = 12;
const PLACEMENT_SEARCH_STEP = 12;
const PLACEMENT_SEARCH_MAX_STEPS = 80;

type LayoutRect = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

function rectsOverlap(left: LayoutRect, right: LayoutRect, gap: number): boolean {
  return !(
    left.x + left.width + gap <= right.x ||
    right.x + right.width + gap <= left.x ||
    left.y + left.height + gap <= right.y ||
    right.y + right.height + gap <= left.y
  );
}

function collectRoundNodeIds(round: DiagnosticTemplateRoundValue): readonly string[] {
  const nodeIds: string[] = [];
  for (const question of round.questions) {
    nodeIds.push(...collectWorkspaceNodeIdsForMovedQuestion(question));
  }
  return nodeIds;
}

function buildAutoLayoutMap(
  round: DiagnosticTemplateRoundValue,
): Map<string, AutoLayoutPlacedNode> {
  const autoLayout = buildAutoLayoutForRound({
    round,
    roundNodeId: buildRoundNodeId(round.id),
    questionNodeId: buildQuestionNodeId,
    optionNodeId: buildOptionNodeId,
    childNodeId: buildChildQuestionNodeId,
  });
  return new Map(autoLayout.children.map((child) => [child.id, child]));
}

function readLayoutRect(params: {
  readonly nodeId: string;
  readonly layout: WorkspaceLayoutSnapshot | null;
  readonly autoLayout: Map<string, AutoLayoutPlacedNode>;
  readonly round: DiagnosticTemplateRoundValue;
}): LayoutRect | null {
  const autoNode = params.autoLayout.get(params.nodeId);
  const saved = params.layout?.nodes[params.nodeId];
  if (autoNode === undefined && saved === undefined) {
    return null;
  }
  if (params.nodeId.startsWith('question:')) {
    const questionId = params.nodeId.slice('question:'.length);
    const question = params.round.questions.find((candidate) => candidate.id === questionId);
    if (question === undefined) {
      return null;
    }
    const estimated = estimateCardSize({
      label: question.prompt,
      kind: 'question',
      subtitle: readQuestionTypeLabel(question.type),
    });
    return {
      x: saved?.x ?? autoNode?.x ?? ROUND_PADDING_X,
      y: saved?.y ?? autoNode?.y ?? ROUND_CONTENT_TOP,
      width: saved?.width ?? autoNode?.width ?? estimated.width,
      height: saved?.height ?? autoNode?.height ?? estimated.height,
    };
  }
  if (params.nodeId.startsWith('option:')) {
    const optionId = params.nodeId.slice('option:'.length);
    for (const question of params.round.questions) {
      const option = question.options.find((candidate) => candidate.id === optionId);
      if (option !== undefined) {
        const estimated = estimateCardSize({ label: option.label, kind: 'option' });
        return {
          x: saved?.x ?? autoNode?.x ?? ROUND_PADDING_X,
          y: saved?.y ?? autoNode?.y ?? ROUND_CONTENT_TOP,
          width: saved?.width ?? autoNode?.width ?? estimated.width,
          height: saved?.height ?? autoNode?.height ?? estimated.height,
        };
      }
    }
    return null;
  }
  if (params.nodeId.startsWith('child:')) {
    const childId = params.nodeId.slice('child:'.length);
    for (const question of params.round.questions) {
      for (const option of question.options) {
        if (option.childQuestion?.id === childId) {
          const estimated = estimateCardSize({
            label: option.childQuestion.prompt,
            kind: 'childQuestion',
          });
          return {
            x: saved?.x ?? autoNode?.x ?? ROUND_PADDING_X,
            y: saved?.y ?? autoNode?.y ?? ROUND_CONTENT_TOP,
            width: saved?.width ?? autoNode?.width ?? estimated.width,
            height: saved?.height ?? autoNode?.height ?? estimated.height,
          };
        }
      }
    }
  }
  return null;
}

function buildObstacleRects(params: {
  readonly round: DiagnosticTemplateRoundValue;
  readonly layout: WorkspaceLayoutSnapshot | null;
  readonly autoLayout: Map<string, AutoLayoutPlacedNode>;
  readonly excludeNodeIds: ReadonlySet<string>;
}): readonly LayoutRect[] {
  const obstacles: LayoutRect[] = [];
  for (const nodeId of collectRoundNodeIds(params.round)) {
    if (params.excludeNodeIds.has(nodeId)) {
      continue;
    }
    const rect = readLayoutRect({
      nodeId,
      layout: params.layout,
      autoLayout: params.autoLayout,
      round: params.round,
    });
    if (rect !== null) {
      obstacles.push(rect);
    }
  }
  return obstacles;
}

function buildSubtreeRects(params: {
  readonly movedNodeIds: readonly string[];
  readonly autoLayout: Map<string, AutoLayoutPlacedNode>;
  readonly delta: FlowPosition;
}): readonly LayoutRect[] {
  const rects: LayoutRect[] = [];
  for (const nodeId of params.movedNodeIds) {
    const autoNode = params.autoLayout.get(nodeId);
    if (autoNode === undefined) {
      continue;
    }
    rects.push({
      x: autoNode.x + params.delta.x,
      y: autoNode.y + params.delta.y,
      width: autoNode.width,
      height: autoNode.height,
    });
  }
  return rects;
}

function hasSubtreeOverlap(params: {
  readonly subtreeRects: readonly LayoutRect[];
  readonly obstacles: readonly LayoutRect[];
}): boolean {
  for (const subtreeRect of params.subtreeRects) {
    for (const obstacle of params.obstacles) {
      if (rectsOverlap(subtreeRect, obstacle, PLACEMENT_GAP)) {
        return true;
      }
    }
  }
  return false;
}

function resolveSubtreeDelta(params: {
  readonly movedNodeIds: readonly string[];
  readonly autoLayout: Map<string, AutoLayoutPlacedNode>;
  readonly obstacles: readonly LayoutRect[];
  readonly preferredRelative: FlowPosition;
}): FlowPosition {
  const questionNodeId = params.movedNodeIds.find((nodeId) => nodeId.startsWith('question:'));
  const autoQuestion =
    questionNodeId === undefined ? undefined : params.autoLayout.get(questionNodeId);
  const baseDelta: FlowPosition = autoQuestion === undefined
    ? { x: 0, y: 0 }
    : {
        x: params.preferredRelative.x - autoQuestion.x,
        y: params.preferredRelative.y - autoQuestion.y,
      };
  const searchOffsets: FlowPosition[] = [{ x: 0, y: 0 }];
  for (let step = 1; step <= PLACEMENT_SEARCH_MAX_STEPS; step += 1) {
    const offset = step * PLACEMENT_SEARCH_STEP;
    searchOffsets.push(
      { x: 0, y: offset },
      { x: offset, y: 0 },
      { x: offset, y: offset },
      { x: -offset, y: 0 },
      { x: 0, y: -offset },
    );
  }
  for (const searchOffset of searchOffsets) {
    const delta = {
      x: baseDelta.x + searchOffset.x,
      y: baseDelta.y + searchOffset.y,
    };
    const subtreeRects = buildSubtreeRects({
      movedNodeIds: params.movedNodeIds,
      autoLayout: params.autoLayout,
      delta,
    });
    if (subtreeRects.length === 0) {
      continue;
    }
    if (!hasSubtreeOverlap({ subtreeRects, obstacles: params.obstacles })) {
      return delta;
    }
  }
  return baseDelta;
}

function buildLayoutEntry(
  autoNode: AutoLayoutPlacedNode,
  delta: FlowPosition,
  previousEntry: WorkspaceNodeLayoutEntry | undefined,
): WorkspaceNodeLayoutEntry {
  const isUserSized = previousEntry?.userSized === true;
  if (isUserSized) {
    return {
      x: autoNode.x + delta.x,
      y: autoNode.y + delta.y,
      width: previousEntry.width,
      height: previousEntry.height,
      userSized: true,
    };
  }
  return {
    x: autoNode.x + delta.x,
    y: autoNode.y + delta.y,
    width: autoNode.width,
    height: autoNode.height,
  };
}

function readQuestionRelativePosition(params: {
  readonly questionNodeId: string;
  readonly layout: WorkspaceLayoutSnapshot | null;
  readonly previousLayout: WorkspaceLayoutSnapshot | null;
  readonly autoLayout: Map<string, AutoLayoutPlacedNode>;
}): FlowPosition {
  const saved =
    params.previousLayout?.nodes[params.questionNodeId] ??
    params.layout?.nodes[params.questionNodeId];
  const autoQuestion = params.autoLayout.get(params.questionNodeId);
  return {
    x: saved?.x ?? autoQuestion?.x ?? ROUND_PADDING_X,
    y: saved?.y ?? autoQuestion?.y ?? ROUND_CONTENT_TOP,
  };
}

/** Moves a question subtree by drag delta within the same round (keeps drop position). */
export function applyQuestionSameRoundMoveLayout(params: {
  readonly template: DiagnosticTemplateValue;
  readonly layout: WorkspaceLayoutSnapshot | null;
  readonly previousLayout: WorkspaceLayoutSnapshot | null;
  readonly roundId: string;
  readonly questionId: string;
  readonly newQuestionRelative: FlowPosition;
}): WorkspaceLayoutSnapshot {
  const round = params.template.rounds.find((candidate) => candidate.id === params.roundId);
  if (round === undefined) {
    return params.layout ?? { nodes: {} };
  }
  const question = round.questions.find((candidate) => candidate.id === params.questionId);
  if (question === undefined) {
    return params.layout ?? { nodes: {} };
  }
  const movedNodeIds = collectWorkspaceNodeIdsForMovedQuestion(question);
  const autoLayout = buildAutoLayoutMap(round);
  const questionNodeId = buildQuestionNodeId(question.id);
  const oldQuestionRelative = readQuestionRelativePosition({
    questionNodeId,
    layout: params.layout,
    previousLayout: params.previousLayout,
    autoLayout,
  });
  const delta: FlowPosition = {
    x: params.newQuestionRelative.x - oldQuestionRelative.x,
    y: params.newQuestionRelative.y - oldQuestionRelative.y,
  };
  const nextNodes: Record<string, WorkspaceNodeLayoutEntry> = {
    ...(params.layout?.nodes ?? {}),
  };
  for (const nodeId of movedNodeIds) {
    const rect = readLayoutRect({
      nodeId,
      layout: params.layout,
      autoLayout,
      round,
    });
    if (rect === null) {
      continue;
    }
    const previousEntry = params.layout?.nodes[nodeId];
    const isUserSized = previousEntry?.userSized === true;
    nextNodes[nodeId] = {
      x: rect.x + delta.x,
      y: rect.y + delta.y,
      ...(isUserSized
        ? { width: previousEntry.width, height: previousEntry.height, userSized: true }
        : { width: rect.width, height: rect.height }),
    };
  }
  return { nodes: nextNodes };
}

/** Places a dropped question and its options/follow-ups without overlapping siblings in the round. */
export function applyQuestionDropLayout(params: {
  readonly template: DiagnosticTemplateValue;
  readonly layout: WorkspaceLayoutSnapshot | null;
  readonly roundId: string;
  readonly questionId: string;
  readonly dropFlowPosition: FlowPosition;
  readonly roundNode: Node;
}): WorkspaceLayoutSnapshot {
  const round = params.template.rounds.find((candidate) => candidate.id === params.roundId);
  if (round === undefined) {
    return params.layout ?? { nodes: {} };
  }
  const question = round.questions.find((candidate) => candidate.id === params.questionId);
  if (question === undefined) {
    return params.layout ?? { nodes: {} };
  }
  const movedNodeIds = collectWorkspaceNodeIdsForMovedQuestion(question);
  const excludeNodeIds = new Set(movedNodeIds);
  const autoLayout = buildAutoLayoutMap(round);
  const obstacles = buildObstacleRects({
    round,
    layout: params.layout,
    autoLayout,
    excludeNodeIds,
  });
  const preferredRelative = clampRoundChildPosition({
    x: params.dropFlowPosition.x - params.roundNode.position.x,
    y: params.dropFlowPosition.y - params.roundNode.position.y,
  });
  const delta = resolveSubtreeDelta({
    movedNodeIds,
    autoLayout,
    obstacles,
    preferredRelative,
  });
  const nextNodes: Record<string, WorkspaceNodeLayoutEntry> = {
    ...(params.layout?.nodes ?? {}),
  };
  for (const nodeId of movedNodeIds) {
    const autoNode = autoLayout.get(nodeId);
    if (autoNode === undefined) {
      continue;
    }
    nextNodes[nodeId] = buildLayoutEntry(autoNode, delta, params.layout?.nodes[nodeId]);
  }
  return { nodes: nextNodes };
}
