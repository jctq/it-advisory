import {
  buildAutoLayoutForRound,
  estimateCardSize,
  type AutoLayoutPlacedNode,
} from '@/components/admin/diagnostic-template-editor/workspace-auto-layout';

function buildRoundNodeId(roundId: string): string {
  return `round:${roundId}`;
}

function buildQuestionNodeId(questionId: string): string {
  return `question:${questionId}`;
}

function buildOptionNodeId(optionId: string): string {
  return `option:${optionId}`;
}

function buildChildQuestionNodeId(childQuestionId: string): string {
  return `child:${childQuestionId}`;
}
import { readQuestionTypeLabel } from '@/components/admin/diagnostic-template-editor/diagnostic-template-editor-utils';
import {
  ROUND_CONTENT_TOP,
  ROUND_MIN_HEIGHT,
  ROUND_MIN_WIDTH,
  ROUND_PADDING_BOTTOM,
  ROUND_PADDING_X,
} from '@/components/admin/diagnostic-template-editor/workspace-layout-constants';
import { collectWorkspaceNodeIdsForMovedQuestion } from '@/components/admin/diagnostic-template-editor/workspace-structural-mutations';
import type { DiagnosticTemplateRoundValue } from '@/lib/diagnostic-template-types';
import type {
  WorkspaceLayoutSnapshot,
  WorkspaceNodeLayoutEntry,
} from '@/components/admin/diagnostic-template-editor/workspace-layout-storage';
export type RoundFitDimensions = {
  readonly width: number;
  readonly height: number;
};

function collectRoundChildNodeIds(round: DiagnosticTemplateRoundValue): readonly string[] {
  const nodeIds: string[] = [];
  for (const question of round.questions) {
    nodeIds.push(...collectWorkspaceNodeIdsForMovedQuestion(question));
  }
  return nodeIds;
}

function readChildLayoutRect(params: {
  readonly nodeId: string;
  readonly round: DiagnosticTemplateRoundValue;
  readonly layout: WorkspaceLayoutSnapshot | null;
  readonly autoLayout: Map<string, AutoLayoutPlacedNode>;
}): { readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null {
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

/** Minimum round size so every child node in the round is visible with padding. */
export function computeRoundFitDimensions(params: {
  readonly round: DiagnosticTemplateRoundValue;
  readonly layout: WorkspaceLayoutSnapshot | null;
  readonly layoutOverrides?: Readonly<Record<string, WorkspaceNodeLayoutEntry>>;
}): RoundFitDimensions {
  const autoLayout = buildAutoLayoutForRound({
    round: params.round,
    roundNodeId: buildRoundNodeId(params.round.id),
    questionNodeId: buildQuestionNodeId,
    optionNodeId: buildOptionNodeId,
    childNodeId: buildChildQuestionNodeId,
  });
  const autoMap = new Map(autoLayout.children.map((child) => [child.id, child]));
  const mergedLayout: WorkspaceLayoutSnapshot | null =
    params.layoutOverrides === undefined
      ? params.layout
      : {
          nodes: {
            ...(params.layout?.nodes ?? {}),
            ...params.layoutOverrides,
          },
        };
  let maxContentRight = ROUND_PADDING_X;
  let maxContentBottom = ROUND_CONTENT_TOP;
  for (const nodeId of collectRoundChildNodeIds(params.round)) {
    const rect = readChildLayoutRect({
      nodeId,
      round: params.round,
      layout: mergedLayout,
      autoLayout: autoMap,
    });
    if (rect === null) {
      continue;
    }
    maxContentRight = Math.max(maxContentRight, rect.x + rect.width);
    maxContentBottom = Math.max(maxContentBottom, rect.y + rect.height);
  }
  return {
    width: Math.max(ROUND_MIN_WIDTH, maxContentRight + ROUND_PADDING_X),
    height: Math.max(ROUND_MIN_HEIGHT, maxContentBottom + ROUND_PADDING_BOTTOM),
  };
}
