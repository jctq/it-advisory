import type { Edge, Node } from '@xyflow/react';
import type { DiagnosticTemplateVisibilityRule, DiagnosticTemplateValue } from '@/lib/diagnostic-template-types';
import { readQuestionTypeLabel } from '@/components/admin/diagnostic-template-editor/diagnostic-template-editor-utils';
import type { WorkspaceLayoutSnapshot } from '@/components/admin/diagnostic-template-editor/workspace-layout-storage';
import { buildAutoLayoutForRound } from '@/components/admin/diagnostic-template-editor/workspace-auto-layout';
import {
  applyWorkspaceEdgeTheme,
  readWorkspaceEdgeStrokeStyle,
  readWorkspaceRoundSequenceEdgeStyle,
} from '@/components/admin/diagnostic-template-editor/workspace-theme';
import {
  buildStructuralHandleIds,
  resolveStructuralConnectionOrientation,
  type WorkspaceNodeRect,
  type WorkspaceStructuralConnectionOrientation,
} from '@/components/admin/diagnostic-template-editor/workspace-connection-orientation';

export type WorkspaceNodeKind = 'round' | 'question' | 'option' | 'childQuestion';

export type WorkspaceNodeData = {
  readonly kind: WorkspaceNodeKind;
  readonly roundId: string;
  readonly questionId?: string;
  readonly optionId?: string;
  readonly childQuestionId?: string;
  readonly label: string;
  readonly subtitle?: string;
};

export type WorkspaceEdgeKind = 'conditional' | 'sequential' | 'child' | 'owns';

export const VISIBILITY_SOURCE_HANDLE_ID = 'visibility-source';

export const VISIBILITY_TARGET_HANDLE_ID = 'visibility-target';

export type WorkspaceEdgeData = {
  readonly kind: WorkspaceEdgeKind;
  readonly showWhen?: DiagnosticTemplateVisibilityRule;
};

import {
  clampRoundChildPosition,
  CARD_DEFAULT_HEIGHT,
  CARD_DEFAULT_WIDTH,
  CARD_MIN_HEIGHT,
  CARD_MIN_WIDTH,
  QUESTION_DEFAULT_HEIGHT,
  ROUND_DEFAULT_MIN_HEIGHT,
  ROUND_DEFAULT_WIDTH,
  ROUND_MIN_HEIGHT,
  ROUND_MIN_WIDTH,
} from '@/components/admin/diagnostic-template-editor/workspace-layout-constants';

export {
  CARD_DEFAULT_HEIGHT,
  CARD_DEFAULT_WIDTH,
  CARD_MIN_HEIGHT,
  CARD_MIN_WIDTH,
  QUESTION_DEFAULT_HEIGHT,
  ROUND_DEFAULT_MIN_HEIGHT,
  ROUND_DEFAULT_WIDTH,
  ROUND_MIN_HEIGHT,
  ROUND_MIN_WIDTH,
} from '@/components/admin/diagnostic-template-editor/workspace-layout-constants';

const ROUND_GAP_Y = 80;

export function buildRoundNodeId(roundId: string): string {
  return `round:${roundId}`;
}

export function buildQuestionNodeId(questionId: string): string {
  return `question:${questionId}`;
}

export function buildOptionNodeId(optionId: string): string {
  return `option:${optionId}`;
}

export function buildChildQuestionNodeId(childQuestionId: string): string {
  return `child:${childQuestionId}`;
}

function resolveNodeDimensions(params: {
  readonly nodeId: string;
  readonly autoWidth: number;
  readonly autoHeight: number;
  readonly layout: WorkspaceLayoutSnapshot | null;
}): { readonly width: number; readonly height: number } {
  const saved = params.layout?.nodes[params.nodeId];
  if (saved?.userSized === true && saved.width !== undefined && saved.height !== undefined) {
    return { width: saved.width, height: saved.height };
  }
  return { width: params.autoWidth, height: params.autoHeight };
}

function resolveNodeRect(params: {
  readonly nodeId: string;
  readonly autoPlacement: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  readonly layout: WorkspaceLayoutSnapshot | null;
}): WorkspaceNodeRect {
  const saved = params.layout?.nodes[params.nodeId];
  return {
    x: saved?.x ?? params.autoPlacement.x,
    y: saved?.y ?? params.autoPlacement.y,
    width: saved?.userSized === true && saved.width !== undefined ? saved.width : params.autoPlacement.width,
    height: saved?.userSized === true && saved.height !== undefined ? saved.height : params.autoPlacement.height,
  };
}

export function buildWorkspaceGraph(params: {
  readonly template: DiagnosticTemplateValue;
  readonly layout: WorkspaceLayoutSnapshot | null;
  readonly structuralConnectionOrientation?: WorkspaceStructuralConnectionOrientation;
  readonly isDark: boolean;
}): { readonly nodes: Node<WorkspaceNodeData>[]; readonly edges: Edge<WorkspaceEdgeData>[] } {
  const structuralOrientation = params.structuralConnectionOrientation ?? 'auto';
  const nodes: Node<WorkspaceNodeData>[] = [];
  const edges: Edge<WorkspaceEdgeData>[] = [];
  let roundYOffset = 40;
  for (const [roundIndex, round] of params.template.rounds.entries()) {
    const roundNodeId = buildRoundNodeId(round.id);
    const savedRoundPosition = params.layout?.nodes[roundNodeId];
    const roundX = savedRoundPosition?.x ?? 80;
    const roundY = savedRoundPosition?.y ?? roundYOffset;
    const autoLayout = buildAutoLayoutForRound({
      round,
      roundNodeId,
      questionNodeId: buildQuestionNodeId,
      optionNodeId: buildOptionNodeId,
      childNodeId: buildChildQuestionNodeId,
    });
    const roundDimensions = resolveNodeDimensions({
      nodeId: roundNodeId,
      autoWidth: autoLayout.roundWidth,
      autoHeight: autoLayout.roundHeight,
      layout: params.layout,
    });
    nodes.push({
      id: roundNodeId,
      type: 'roundGroup',
      position: { x: roundX, y: roundY },
      data: {
        kind: 'round',
        roundId: round.id,
        label: `R${roundIndex + 1} · ${round.title.trim() || `Round ${roundIndex + 1}`}`,
        subtitle: `${round.questions.length} question${round.questions.length === 1 ? '' : 's'} · customer order ${roundIndex + 1}`,
      },
      style: { width: roundDimensions.width, height: roundDimensions.height },
      zIndex: 0,
      draggable: true,
      selectable: true,
    });
    const childById = new Map(autoLayout.children.map((child) => [child.id, child]));
    for (const [questionIndex, question] of round.questions.entries()) {
      const questionNodeId = buildQuestionNodeId(question.id);
      const autoQuestion = childById.get(questionNodeId);
      if (autoQuestion !== undefined) {
        const savedQuestion = params.layout?.nodes[questionNodeId];
        const questionDimensions = resolveNodeDimensions({
          nodeId: questionNodeId,
          autoWidth: autoQuestion.width,
          autoHeight: autoQuestion.height,
          layout: params.layout,
        });
        nodes.push({
          id: questionNodeId,
          type: 'workspaceCard',
          parentId: roundNodeId,
          extent: 'parent',
          position: clampRoundChildPosition({
            x: savedQuestion?.x ?? autoQuestion.x,
            y: savedQuestion?.y ?? autoQuestion.y,
          }),
          data: {
            kind: 'question',
            roundId: round.id,
            questionId: question.id,
            label: question.prompt.trim() || `Question ${questionIndex + 1}`,
            subtitle: readQuestionTypeLabel(question.type),
          },
          style: { width: questionDimensions.width, height: questionDimensions.height },
          zIndex: 10,
          draggable: true,
          selectable: true,
        });
        if (questionIndex > 0) {
          const previousQuestion = round.questions[questionIndex - 1];
          if (previousQuestion !== undefined) {
            edges.push({
              id: `seq:${previousQuestion.id}:${question.id}`,
              source: buildQuestionNodeId(previousQuestion.id),
              target: questionNodeId,
              sourceHandle: VISIBILITY_SOURCE_HANDLE_ID,
              targetHandle: VISIBILITY_TARGET_HANDLE_ID,
              type: 'smoothstep',
              data: { kind: 'sequential' },
              style: readWorkspaceEdgeStrokeStyle('sequential', params.isDark),
            });
          }
        }
        appendConditionalEdge({
          edges,
          rule: question.showWhen,
          targetId: questionNodeId,
          targetRoundIndex: roundIndex,
          targetQuestionIndex: questionIndex,
          isDark: params.isDark,
        });
      }
      for (const option of question.options) {
        const optionNodeId = buildOptionNodeId(option.id);
        const autoOption = childById.get(optionNodeId);
        if (autoOption !== undefined) {
          const savedOption = params.layout?.nodes[optionNodeId];
          const optionDimensions = resolveNodeDimensions({
            nodeId: optionNodeId,
            autoWidth: autoOption.width,
            autoHeight: autoOption.height,
            layout: params.layout,
          });
          nodes.push({
            id: optionNodeId,
            type: 'workspaceCard',
            parentId: roundNodeId,
            extent: 'parent',
            position: clampRoundChildPosition({
              x: savedOption?.x ?? autoOption.x,
              y: savedOption?.y ?? autoOption.y,
            }),
            data: {
              kind: 'option',
              roundId: round.id,
              questionId: question.id,
              optionId: option.id,
              label: option.label.trim() || 'Untitled option',
            },
            style: { width: optionDimensions.width, height: optionDimensions.height },
            zIndex: 10,
            draggable: true,
            selectable: true,
          });
          const autoQuestionPlacement = childById.get(questionNodeId);
          if (autoQuestionPlacement !== undefined) {
            const ownsOrientation = resolveStructuralConnectionOrientation({
              preference: structuralOrientation,
              sourceRect: resolveNodeRect({
                nodeId: questionNodeId,
                autoPlacement: autoQuestionPlacement,
                layout: params.layout,
              }),
              targetRect: resolveNodeRect({
                nodeId: optionNodeId,
                autoPlacement: autoOption,
                layout: params.layout,
              }),
            });
            const ownsHandles = buildStructuralHandleIds({ orientation: ownsOrientation, kind: 'owns' });
            edges.push({
              id: `owns:${question.id}:${option.id}`,
              source: questionNodeId,
              target: optionNodeId,
              sourceHandle: ownsHandles.sourceHandle,
              targetHandle: ownsHandles.targetHandle,
              type: 'smoothstep',
              data: { kind: 'owns' },
              style: readWorkspaceEdgeStrokeStyle('owns', params.isDark),
              animated: false,
            });
          }
          appendConditionalEdge({
            edges,
            rule: option.showWhen,
            targetId: optionNodeId,
            targetRoundIndex: roundIndex,
            targetQuestionIndex: questionIndex,
            isDark: params.isDark,
          });
        }
        if (option.childQuestion !== null) {
          const childNodeId = buildChildQuestionNodeId(option.childQuestion.id);
          const autoChild = childById.get(childNodeId);
          if (autoChild !== undefined) {
            const savedChild = params.layout?.nodes[childNodeId];
            const childDimensions = resolveNodeDimensions({
              nodeId: childNodeId,
              autoWidth: autoChild.width,
              autoHeight: autoChild.height,
              layout: params.layout,
            });
            nodes.push({
              id: childNodeId,
              type: 'workspaceCard',
              parentId: roundNodeId,
              extent: 'parent',
              position: clampRoundChildPosition({
                x: savedChild?.x ?? autoChild.x,
                y: savedChild?.y ?? autoChild.y,
              }),
              data: {
                kind: 'childQuestion',
                roundId: round.id,
                questionId: question.id,
                optionId: option.id,
                childQuestionId: option.childQuestion.id,
                label: option.childQuestion.prompt.trim() || 'Follow-up question',
                subtitle: `${option.childQuestion.options.length} nested option${option.childQuestion.options.length === 1 ? '' : 's'}`,
              },
              style: { width: childDimensions.width, height: childDimensions.height },
              zIndex: 10,
              draggable: true,
              selectable: true,
            });
            const autoOptionPlacement = childById.get(optionNodeId);
            if (autoOptionPlacement !== undefined) {
              const childOrientation = resolveStructuralConnectionOrientation({
                preference: structuralOrientation,
                sourceRect: resolveNodeRect({
                  nodeId: optionNodeId,
                  autoPlacement: autoOptionPlacement,
                  layout: params.layout,
                }),
                targetRect: resolveNodeRect({
                  nodeId: childNodeId,
                  autoPlacement: autoChild,
                  layout: params.layout,
                }),
              });
              const childHandles = buildStructuralHandleIds({ orientation: childOrientation, kind: 'child' });
              edges.push({
                id: `child:${option.id}:${option.childQuestion.id}`,
                source: optionNodeId,
                target: childNodeId,
                sourceHandle: childHandles.sourceHandle,
                targetHandle: childHandles.targetHandle,
                type: 'smoothstep',
                animated: false,
                data: { kind: 'child' },
                style: readWorkspaceEdgeStrokeStyle('child', params.isDark),
                label: 'follow-up',
              });
            }
          }
        }
      }
    }
    appendConditionalEdge({
      edges,
      rule: round.showWhen,
      targetId: roundNodeId,
      targetRoundIndex: roundIndex,
      isDark: params.isDark,
    });
    const previousRound = params.template.rounds[roundIndex - 1];
    if (previousRound !== undefined) {
      edges.push({
        id: `round-seq:${previousRound.id}:${round.id}`,
        source: buildRoundNodeId(previousRound.id),
        target: roundNodeId,
        sourceHandle: VISIBILITY_SOURCE_HANDLE_ID,
        targetHandle: VISIBILITY_TARGET_HANDLE_ID,
        type: 'smoothstep',
        data: { kind: 'sequential' },
        style: readWorkspaceRoundSequenceEdgeStyle(params.isDark),
        label: 'next round',
      });
    }
    roundYOffset = roundY + roundDimensions.height + ROUND_GAP_Y;
  }
  return { nodes, edges: applyWorkspaceEdgeTheme(edges, params.isDark) };
}

function appendConditionalEdge(params: {
  readonly edges: Edge<WorkspaceEdgeData>[];
  readonly rule: DiagnosticTemplateVisibilityRule;
  readonly targetId: string;
  readonly targetRoundIndex: number;
  readonly targetQuestionIndex?: number;
  readonly isDark: boolean;
}): void {
  if (params.rule === null) {
    return;
  }
  const sourceId = buildQuestionNodeId(params.rule.sourceQuestionId);
  params.edges.push({
    id: `cond:${params.rule.sourceQuestionId}:${params.targetId}`,
    source: sourceId,
    target: params.targetId,
    sourceHandle: VISIBILITY_SOURCE_HANDLE_ID,
    targetHandle: VISIBILITY_TARGET_HANDLE_ID,
    type: 'smoothstep',
    animated: true,
    data: { kind: 'conditional', showWhen: params.rule },
    style: readWorkspaceEdgeStrokeStyle('conditional', params.isDark),
    label: params.rule.match === 'all' ? 'all' : 'any',
  });
}

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

export function collectLayoutFromNodes(
  nodes: readonly Node<WorkspaceNodeData>[],
  options: { readonly userSizedNodeIds?: ReadonlySet<string> } = {},
): WorkspaceLayoutSnapshot {
  const layoutEntries: Record<string, { x: number; y: number; width?: number; height?: number; userSized?: boolean }> = {};
  for (const node of nodes) {
    const width =
      readNodeDimension(node.width) ??
      readNodeDimension(node.style?.width) ??
      readNodeDimension(node.measured?.width);
    const height =
      readNodeDimension(node.height) ??
      readNodeDimension(node.style?.height) ??
      readNodeDimension(node.measured?.height);
    const isUserSized = options.userSizedNodeIds?.has(node.id) === true;
    layoutEntries[node.id] = {
      x: node.position.x,
      y: node.position.y,
      ...(width !== undefined ? { width } : {}),
      ...(height !== undefined ? { height } : {}),
      ...(isUserSized ? { userSized: true } : {}),
    };
  }
  return { nodes: layoutEntries };
}

export function filterNodesBySearch(nodes: readonly Node<WorkspaceNodeData>[], query: string): readonly string[] {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) {
    return nodes.map((node) => node.id);
  }
  return nodes
    .filter((node) => {
      const label = node.data.label.toLowerCase();
      const subtitle = node.data.subtitle?.toLowerCase() ?? '';
      return label.includes(normalized) || subtitle.includes(normalized) || node.id.toLowerCase().includes(normalized);
    })
    .map((node) => node.id);
}
