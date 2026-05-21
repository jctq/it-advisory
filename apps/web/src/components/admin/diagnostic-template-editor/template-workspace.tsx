'use client';

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type OnConnect,
  type OnReconnect,
  type OnSelectionChangeFunc,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  buildChildQuestionNodeId,
  buildOptionNodeId,
  buildRoundNodeId,
  buildWorkspaceGraph,
  collectLayoutFromNodes,
  filterNodesBySearch,
  buildQuestionNodeId,
  VISIBILITY_SOURCE_HANDLE_ID,
  VISIBILITY_TARGET_HANDLE_ID,
  type WorkspaceEdgeData,
  type WorkspaceNodeData,
} from '@/components/admin/diagnostic-template-editor/build-workspace-graph';
import {
  WorkspaceCanvasSettingsProvider,
} from '@/components/admin/diagnostic-template-editor/workspace-canvas-settings-context';
import {
  isChildSourceHandle,
  isChildTargetHandle,
  isOwnsSourceHandle,
  isOwnsTargetHandle,
  type WorkspaceStructuralConnectionOrientation,
} from '@/components/admin/diagnostic-template-editor/workspace-connection-orientation';
import {
  detachQuestionNodeForDrag,
  elevateNodeForDrag,
  reattachQuestionNodeAtRelativePosition,
  resolveRoundIdAtFlowPosition,
  WORKSPACE_DRAGGING_Z_INDEX,
} from '@/components/admin/diagnostic-template-editor/workspace-round-hit-test';
import {
  applyQuestionDropLayout,
  applyQuestionSameRoundMoveLayout,
} from '@/components/admin/diagnostic-template-editor/workspace-round-placement';
import { computeRoundFitDimensions } from '@/components/admin/diagnostic-template-editor/workspace-round-bounds';
import {
  collectWorkspaceNodeIdsForMovedQuestion,
  moveChildQuestionToOption,
  moveOptionToQuestion,
  moveQuestionAfterPredecessor,
  moveQuestionToRound,
  parseChildQuestionIdFromNodeId,
  parseOptionIdFromNodeId,
  parseQuestionIdFromNodeId,
} from '@/components/admin/diagnostic-template-editor/workspace-structural-mutations';
import { WorkspaceToolbar } from '@/components/admin/diagnostic-template-editor/workspace-toolbar';
import {
  buildDefaultVisibilityRuleForSource,
  findOptionById,
  findQuestionById,
} from '@/components/admin/diagnostic-template-editor/diagnostic-template-editor-utils';
import {
  applyShowWhenToTarget,
  useTemplateEditor,
} from '@/components/admin/diagnostic-template-editor/template-editor-context';
import { TemplateWorkspaceInspector } from '@/components/admin/diagnostic-template-editor/template-workspace-inspector';
import {
  selectionFromNodeId,
  TemplateWorkspacePalette,
} from '@/components/admin/diagnostic-template-editor/template-workspace-palette';
import type { TemplateEditorSelection } from '@/components/admin/diagnostic-template-editor/template-editor-context';
import type { DiagnosticTemplateValue } from '@/lib/diagnostic-template-types';
import { RoundGroupNode, WorkspaceCardNode } from '@/components/admin/diagnostic-template-editor/workspace-nodes';
import {
  clearWorkspaceLayout,
  DEFAULT_WORKSPACE_SNAP_SETTINGS,
  pruneWorkspaceLayoutNodeIds,
  readWorkspaceLayout,
  readWorkspaceSnapSettings,
  writeWorkspaceSnapSettings,
  type WorkspaceLayoutSnapshot,
  type WorkspaceSnapSettings,
} from '@/components/admin/diagnostic-template-editor/workspace-layout-storage';
import { applyWorkspaceNodeRemovals } from '@/components/admin/diagnostic-template-editor/workspace-template-mutations';
import { notifySuccess } from '@/lib/notify';
import {
  snapWorkspaceNodePosition,
  WORKSPACE_SNAP_GRID_SIZE,
  type SnapGuideLines,
} from '@/components/admin/diagnostic-template-editor/workspace-node-snap';
import { WorkspaceSnapGuides } from '@/components/admin/diagnostic-template-editor/workspace-snap-guides';
import {
  isSourceEarlierThanTarget,
  resolveQuestionIdForNodeTarget,
  wouldCreateShowWhenCycle,
} from '@/components/admin/diagnostic-template-editor/validate-show-when-graph';
import { useWorkspaceAppearance } from '@/components/admin/diagnostic-template-editor/use-workspace-appearance';
import {
  WORKSPACE_CANVAS_CLASS,
  WORKSPACE_FLOW_CONTROLS_CLASS,
  WORKSPACE_MINIMAP_CLASS,
  WORKSPACE_PANEL_CLASS,
  readWorkspaceCanvasDotColor,
  readWorkspaceMinimapNodeColor,
} from '@/components/admin/diagnostic-template-editor/workspace-theme';
import { TooltipProvider } from '@/components/ui/tooltip';
import { clampRoundChildPosition } from '@/components/admin/diagnostic-template-editor/workspace-layout-constants';
import { notifyError } from '@/lib/notify';
import { cn } from '@/lib/utils';

const NODE_TYPES = {
  roundGroup: RoundGroupNode,
  workspaceCard: WorkspaceCardNode,
};

/** React Flow requires parent nodes before children in the nodes array. */
function orderNodesForDragRender(
  nodes: readonly Node<WorkspaceNodeData>[],
  draggingNodeId: string | null,
): readonly Node<WorkspaceNodeData>[] {
  if (draggingNodeId === null) {
    return nodes;
  }
  const draggedNode = nodes.find((node) => node.id === draggingNodeId);
  if (draggedNode === undefined) {
    return nodes;
  }
  if (draggedNode.data.kind === 'round') {
    const rest = nodes.filter(
      (node) => node.id !== draggingNodeId && node.parentId !== draggingNodeId,
    );
    const children = nodes.filter((node) => node.parentId === draggingNodeId);
    return [...rest, draggedNode, ...children];
  }
  return [
    ...nodes.filter((node) => node.id !== draggingNodeId),
    draggedNode,
  ];
}

function applyRoundFitDimensionsToNodes(
  currentNodes: readonly Node<WorkspaceNodeData>[],
  template: DiagnosticTemplateValue,
): Node<WorkspaceNodeData>[] {
  const layoutFromNodes = collectLayoutFromNodes(currentNodes);
  return currentNodes.map((node) => {
    if (node.data.kind !== 'round' || node.data.roundId === undefined) {
      return node;
    }
    const round = template.rounds.find((candidate) => candidate.id === node.data.roundId);
    if (round === undefined) {
      return node;
    }
    const fitDimensions = computeRoundFitDimensions({ round, layout: layoutFromNodes });
    const currentWidth =
      typeof node.style?.width === 'number'
        ? node.style.width
        : typeof node.width === 'number'
          ? node.width
          : fitDimensions.width;
    const currentHeight =
      typeof node.style?.height === 'number'
        ? node.style.height
        : typeof node.height === 'number'
          ? node.height
          : fitDimensions.height;
    const nextWidth = Math.max(currentWidth, fitDimensions.width);
    const nextHeight = Math.max(currentHeight, fitDimensions.height);
    if (nextWidth === currentWidth && nextHeight === currentHeight) {
      return node;
    }
    return {
      ...node,
      style: { ...node.style, width: nextWidth, height: nextHeight },
    };
  });
}

function resolveSelectedNodeId(
  editorSelection: TemplateEditorSelection,
  template: DiagnosticTemplateValue,
): string | null {
  if (editorSelection === null) {
    return null;
  }
  if (editorSelection.kind === 'round') {
    return buildRoundNodeId(editorSelection.roundId);
  }
  if (editorSelection.kind === 'question') {
    return buildQuestionNodeId(editorSelection.questionId);
  }
  if (editorSelection.kind === 'option') {
    return buildOptionNodeId(editorSelection.optionId);
  }
  for (const round of template.rounds) {
    for (const question of round.questions) {
      const option = question.options.find((candidate) => candidate.id === editorSelection.optionId);
      if (option?.childQuestion !== null && option?.childQuestion !== undefined) {
        return buildChildQuestionNodeId(option.childQuestion.id);
      }
    }
  }
  return null;
}

function TemplateWorkspaceCanvas(): ReactElement {
  const {
    template,
    layoutRevision,
    updateTemplate,
    commitWorkspaceLayout,
    refreshWorkspaceLayout,
    pushEditorHistorySnapshot,
    setSelection,
    selection,
  } = useTemplateEditor();
  const { isDark } = useWorkspaceAppearance();
  const { fitView, screenToFlowPosition } = useReactFlow();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [dropTargetRoundId, setDropTargetRoundId] = useState<string | null>(null);
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [snapSettings, setSnapSettings] = useState<WorkspaceSnapSettings>(DEFAULT_WORKSPACE_SNAP_SETTINGS);
  useEffect(() => {
    setSnapSettings(readWorkspaceSnapSettings());
  }, []);
  const [snapGuides, setSnapGuides] = useState<SnapGuideLines | null>(null);
  const layoutBeforeInteractionRef = useRef<WorkspaceLayoutSnapshot | null>(null);
  const pendingLayoutCommitRef = useRef<{
    readonly resizedNodeIds?: ReadonlySet<string>;
    readonly previousLayout?: WorkspaceLayoutSnapshot | null;
    readonly onlyPersistNodeIds?: ReadonlySet<string>;
  } | null>(null);
  const layout = useMemo(() => {
    void layoutRevision;
    return readWorkspaceLayout(template.id);
  }, [layoutRevision, template.id]);
  const graph = useMemo(
    () =>
      buildWorkspaceGraph({
        template,
        layout,
        structuralConnectionOrientation: snapSettings.structuralConnectionOrientation,
        isDark,
      }),
    [isDark, layout, snapSettings.structuralConnectionOrientation, template],
  );
  const [nodes, setNodes, onNodesChange] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graph.edges);
  const shouldFitViewOnTemplateLoadRef = useRef<boolean>(true);
  const shouldFitViewAfterResetRef = useRef<boolean>(false);
  const isQuestionCrossRoundDragRef = useRef<boolean>(false);
  useEffect(() => {
    shouldFitViewOnTemplateLoadRef.current = true;
  }, [template.id]);
  useEffect(() => {
    if (isQuestionCrossRoundDragRef.current) {
      return;
    }
    setNodes(graph.nodes);
    setEdges(graph.edges);
    const shouldFitView = shouldFitViewOnTemplateLoadRef.current || shouldFitViewAfterResetRef.current;
    if (!shouldFitView) {
      return;
    }
    shouldFitViewOnTemplateLoadRef.current = false;
    shouldFitViewAfterResetRef.current = false;
    window.requestAnimationFrame(() => {
      fitView({ padding: 0.15, duration: 200 });
    });
  }, [fitView, graph.edges, graph.nodes, setEdges, setNodes]);
  const matchingNodeIds = useMemo(() => filterNodesBySearch(nodes, searchQuery), [nodes, searchQuery]);
  const selectedRoundId = selection?.kind === 'round' ? selection.roundId : selection?.kind === 'question' ? selection.roundId : selection?.kind === 'option' ? selection.roundId : selection?.kind === 'childQuestion' ? selection.roundId : null;
  const selectedQuestionId =
    selection?.kind === 'question'
      ? selection.questionId
      : selection?.kind === 'option' || selection?.kind === 'childQuestion'
        ? selection.questionId
        : null;
  const selectedOptionId =
    selection?.kind === 'option' ? selection.optionId : selection?.kind === 'childQuestion' ? selection.optionId : null;
  const persistLayout = useCallback(
    (
      nextNodes: readonly Node<WorkspaceNodeData>[],
      options: {
        readonly resizedNodeIds?: ReadonlySet<string>;
        readonly previousLayout?: WorkspaceLayoutSnapshot | null;
        readonly recordHistory?: boolean;
        readonly onlyPersistNodeIds?: ReadonlySet<string>;
      } = {},
    ): void => {
      const existingLayout = readWorkspaceLayout(template.id);
      const userSizedNodeIds = new Set<string>(options.resizedNodeIds ?? []);
      if (existingLayout !== null) {
        for (const [nodeId, entry] of Object.entries(existingLayout.nodes)) {
          if (entry.userSized === true) {
            userSizedNodeIds.add(nodeId);
          }
        }
      }
      const rawLayout = collectLayoutFromNodes(nextNodes, { userSizedNodeIds });
      const persistedEntries = Object.entries(rawLayout.nodes).map(([nodeId, entry]) => {
        if (userSizedNodeIds.has(nodeId)) {
          return [nodeId, entry] as const;
        }
        return [nodeId, { x: entry.x, y: entry.y }] as const;
      });
      const nextLayoutNodes: WorkspaceLayoutSnapshot['nodes'] =
        options.onlyPersistNodeIds === undefined
          ? Object.fromEntries(persistedEntries)
          : {
              ...(existingLayout?.nodes ?? {}),
              ...Object.fromEntries(
                persistedEntries.filter(([nodeId]) => options.onlyPersistNodeIds?.has(nodeId)),
              ),
            };
      const nextLayout: WorkspaceLayoutSnapshot = {
        nodes: nextLayoutNodes,
      };
      commitWorkspaceLayout(nextLayout, {
        previousLayout: options.previousLayout,
        recordHistory: options.recordHistory,
      });
    },
    [commitWorkspaceLayout, template.id],
  );
  useLayoutEffect(() => {
    const pendingLayoutCommit = pendingLayoutCommitRef.current;
    if (pendingLayoutCommit === null) {
      return;
    }
    pendingLayoutCommitRef.current = null;
    persistLayout(nodes, {
      resizedNodeIds: pendingLayoutCommit.resizedNodeIds,
      previousLayout: pendingLayoutCommit.previousLayout,
      onlyPersistNodeIds: pendingLayoutCommit.onlyPersistNodeIds,
    });
  }, [nodes, persistLayout]);
  const captureLayoutBeforeInteraction = useCallback((): void => {
    if (layoutBeforeInteractionRef.current !== null) {
      return;
    }
    layoutBeforeInteractionRef.current = readWorkspaceLayout(template.id);
  }, [template.id]);
  const readCapturedLayoutBeforeInteraction = useCallback((): WorkspaceLayoutSnapshot | null => {
    const captured = layoutBeforeInteractionRef.current;
    layoutBeforeInteractionRef.current = null;
    return captured;
  }, []);
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<WorkspaceNodeData>>[]) => {
      const removalChanges = changes.filter(
        (change): change is NodeChange<Node<WorkspaceNodeData>> & { type: 'remove'; id: string } =>
          change.type === 'remove',
      );
      const nonRemovalChanges = changes.filter((change) => change.type !== 'remove');
      if (removalChanges.length > 0) {
        const layoutBeforeRemoval = readWorkspaceLayout(template.id);
        pushEditorHistorySnapshot({ template, layout: layoutBeforeRemoval });
        const { template: nextTemplate, prunedLayoutNodeIds } = applyWorkspaceNodeRemovals({
          template,
          removedNodeIds: removalChanges.map((change) => change.id),
        });
        updateTemplate(() => nextTemplate, { shouldReindex: false, recordHistory: false });
        pruneWorkspaceLayoutNodeIds(template.id, prunedLayoutNodeIds);
        refreshWorkspaceLayout();
        const removedQuestionIds = new Set(
          removalChanges
            .filter((change) => change.id.startsWith('question:'))
            .map((change) => change.id.slice('question:'.length)),
        );
        const removedOptionIds = new Set(
          removalChanges
            .filter((change) => change.id.startsWith('option:'))
            .map((change) => change.id.slice('option:'.length)),
        );
        if (
          selection?.kind === 'question' &&
          removedQuestionIds.has(selection.questionId)
        ) {
          setSelection({ kind: 'round', roundId: selection.roundId });
        } else if (
          selection?.kind === 'option' &&
          removedOptionIds.has(selection.optionId)
        ) {
          setSelection({
            kind: 'question',
            roundId: selection.roundId,
            questionId: selection.questionId,
          });
        } else if (selection?.kind === 'childQuestion') {
          const optionAfterRemoval = nextTemplate.rounds
            .find((round) => round.id === selection.roundId)
            ?.questions.find((question) => question.id === selection.questionId)
            ?.options.find((option) => option.id === selection.optionId);
          if (optionAfterRemoval?.childQuestion === null || optionAfterRemoval === undefined) {
            setSelection({
              kind: 'option',
              roundId: selection.roundId,
              questionId: selection.questionId,
              optionId: selection.optionId,
            });
          }
        } else if (selection?.kind === 'round' && removalChanges.some((change) => change.id === `round:${selection.roundId}`)) {
          setSelection(null);
        }
      }
      if (nonRemovalChanges.length > 0) {
        onNodesChange(nonRemovalChanges);
      }
      const hasResizeStart = nonRemovalChanges.some(
        (change) => change.type === 'dimensions' && change.resizing === true,
      );
      if (hasResizeStart) {
        captureLayoutBeforeInteraction();
      }
      const hasFinishedResize = nonRemovalChanges.some(
        (change) => change.type === 'dimensions' && change.resizing === false,
      );
      if (!hasFinishedResize) {
        return;
      }
      if (!hasResizeStart && layoutBeforeInteractionRef.current === null) {
        return;
      }
      const resizedNodeIds = new Set(
        nonRemovalChanges
          .filter((change): change is NodeChange<Node<WorkspaceNodeData>> & { type: 'dimensions'; id: string; resizing: false } =>
            change.type === 'dimensions' && change.resizing === false,
          )
          .map((change) => change.id),
      );
      const previousLayout = readCapturedLayoutBeforeInteraction();
      pendingLayoutCommitRef.current = { resizedNodeIds, previousLayout };
    },
    [
      captureLayoutBeforeInteraction,
      onNodesChange,
      pushEditorHistorySnapshot,
      readCapturedLayoutBeforeInteraction,
      refreshWorkspaceLayout,
      selection,
      setSelection,
      template,
      updateTemplate,
    ],
  );
  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (connection.source === null || connection.target === null) {
        return;
      }
      if (isOwnsSourceHandle(connection.sourceHandle) && isOwnsTargetHandle(connection.targetHandle)) {
        const optionId = parseOptionIdFromNodeId(connection.target);
        const questionId = parseQuestionIdFromNodeId(connection.source);
        if (optionId === null || questionId === null) {
          notifyError('Connect a question handle to an option to assign ownership.');
          return;
        }
        updateTemplate((current) => moveOptionToQuestion({ template: current, optionId, targetQuestionId: questionId }));
        notifySuccess('Option moved to question.');
        return;
      }
      if (isChildSourceHandle(connection.sourceHandle) && isChildTargetHandle(connection.targetHandle)) {
        const childQuestionId = parseChildQuestionIdFromNodeId(connection.target);
        const optionId = parseOptionIdFromNodeId(connection.source);
        if (childQuestionId === null || optionId === null) {
          notifyError('Connect an option handle to a follow-up question to reassign it.');
          return;
        }
        const targetOptionMeta = findOptionById(template, optionId);
        if (targetOptionMeta === null) {
          return;
        }
        if (
          targetOptionMeta.option.childQuestion !== null &&
          targetOptionMeta.option.childQuestion.id !== childQuestionId
        ) {
          notifyError('That option already has a follow-up question.');
          return;
        }
        updateTemplate((current) =>
          moveChildQuestionToOption({ template: current, childQuestionId, targetOptionId: optionId }),
        );
        notifySuccess('Follow-up question moved to option.');
        return;
      }
      if (
        connection.sourceHandle !== null &&
        connection.sourceHandle !== undefined &&
        connection.sourceHandle !== VISIBILITY_SOURCE_HANDLE_ID
      ) {
        notifyError('Use the right-side handle on a question to create visibility rules.');
        return;
      }
      if (
        connection.targetHandle !== null &&
        connection.targetHandle !== undefined &&
        connection.targetHandle !== VISIBILITY_TARGET_HANDLE_ID
      ) {
        notifyError('Visibility rules connect to the left-side handle on the target node.');
        return;
      }
      const sourceQuestionId = connection.source.startsWith('question:')
        ? connection.source.slice('question:'.length)
        : null;
      if (sourceQuestionId === null) {
        notifyError('Conditional edges must start from a question node.');
        return;
      }
      const sourceMeta = findQuestionById(template, sourceQuestionId);
      if (sourceMeta === null) {
        return;
      }
      const targetQuestionId = resolveQuestionIdForNodeTarget({
        template,
        targetNodeId: connection.target,
      });
      if (wouldCreateShowWhenCycle({ template, sourceQuestionId, targetQuestionId })) {
        notifyError('This connection would create a circular visibility rule.');
        return;
      }
      const targetRoundIndex = template.rounds.findIndex((round) =>
        connection.target.startsWith('round:')
          ? round.id === connection.target.slice('round:'.length)
          : round.questions.some(
              (question) =>
                connection.target.startsWith('question:') && question.id === connection.target.slice('question:'.length),
            ) ||
            round.questions.some((question) =>
              question.options.some(
                (option) =>
                  connection.target.startsWith('option:') && option.id === connection.target.slice('option:'.length),
              ),
            ),
      );
      const targetQuestionIndex =
        targetQuestionId === null
          ? undefined
          : template.rounds[targetRoundIndex]?.questions.findIndex((question) => question.id === targetQuestionId);
      if (
        targetQuestionId !== null &&
        !isSourceEarlierThanTarget({
          template,
          sourceQuestionId,
          targetRoundIndex: targetRoundIndex === -1 ? 0 : targetRoundIndex,
          targetQuestionIndex: targetQuestionIndex === -1 ? undefined : targetQuestionIndex,
        })
      ) {
        notifyError('Visibility source must come from an earlier question.');
        return;
      }
      const rule = buildDefaultVisibilityRuleForSource({
        sourceId: sourceQuestionId,
        optionChoices: sourceMeta.question.options.map((option) => ({
          id: option.id,
          label: option.label,
        })),
      });
      updateTemplate((current) =>
        applyShowWhenToTarget({ template: current, targetNodeId: connection.target as string, rule }),
      );
    },
    [template, updateTemplate],
  );
  const handleReconnect: OnReconnect<Edge<WorkspaceEdgeData>> = useCallback(
    (oldEdge, connection) => {
      if (connection.source === null || connection.target === null) {
        return;
      }
      const edgeKind = oldEdge.data?.kind;
      if (edgeKind === 'owns') {
        const optionId = parseOptionIdFromNodeId(connection.target);
        const questionId = parseQuestionIdFromNodeId(connection.source);
        if (optionId === null || questionId === null) {
          notifyError('Reconnect the question handle to an option.');
          return;
        }
        updateTemplate((current) => moveOptionToQuestion({ template: current, optionId, targetQuestionId: questionId }));
        notifySuccess('Option moved to question.');
        return;
      }
      if (edgeKind === 'sequential' && oldEdge.id.startsWith('seq:')) {
        const followerQuestionId = parseQuestionIdFromNodeId(connection.target);
        const predecessorQuestionId = parseQuestionIdFromNodeId(connection.source);
        if (followerQuestionId === null || predecessorQuestionId === null) {
          notifyError('Reconnect between two question nodes to change order or round.');
          return;
        }
        updateTemplate((current) =>
          moveQuestionAfterPredecessor({
            template: current,
            questionId: followerQuestionId,
            predecessorQuestionId,
          }),
        );
        notifySuccess('Question moved.');
        return;
      }
      if (edgeKind === 'child') {
        const childQuestionId = parseChildQuestionIdFromNodeId(connection.target);
        const optionId = parseOptionIdFromNodeId(connection.source);
        if (childQuestionId === null || optionId === null) {
          notifyError('Reconnect the option handle to a follow-up question.');
          return;
        }
        const targetOptionMeta = findOptionById(template, optionId);
        if (targetOptionMeta === null) {
          return;
        }
        if (
          targetOptionMeta.option.childQuestion !== null &&
          targetOptionMeta.option.childQuestion.id !== childQuestionId
        ) {
          notifyError('That option already has a follow-up question.');
          return;
        }
        updateTemplate((current) =>
          moveChildQuestionToOption({ template: current, childQuestionId, targetOptionId: optionId }),
        );
        notifySuccess('Follow-up question moved to option.');
      }
    },
    [template, updateTemplate],
  );
  const handleNodeDrag = useCallback(
    (event: React.MouseEvent, node: Node<WorkspaceNodeData>) => {
      if (node.data.kind === 'question' && node.data.roundId !== undefined) {
        const roundNodes = nodes.filter((candidate) => candidate.data.kind === 'round');
        const dropPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
        const hoveredRoundId = resolveRoundIdAtFlowPosition({ flowPosition: dropPosition, roundNodes });
        setDropTargetRoundId(
          hoveredRoundId !== null && hoveredRoundId !== node.data.roundId ? hoveredRoundId : null,
        );
      }
      if (!snapSettings.gridSnap && !snapSettings.alignmentSnap) {
        setSnapGuides(null);
        return;
      }
      const snapResult = snapWorkspaceNodePosition({
        node,
        position: node.position,
        nodes,
        enableGridSnap: snapSettings.gridSnap,
        enableAlignmentSnap: snapSettings.alignmentSnap,
        gridSize: WORKSPACE_SNAP_GRID_SIZE,
      });
      setSnapGuides(snapResult.guides);
      const nextPosition =
        node.parentId === undefined
          ? snapResult.position
          : clampRoundChildPosition(snapResult.position);
      setNodes((currentNodes) =>
        currentNodes.map((candidate) =>
          candidate.id === node.id
            ? elevateNodeForDrag({ ...candidate, position: nextPosition })
            : candidate,
        ),
      );
    },
    [nodes, screenToFlowPosition, setNodes, snapSettings.alignmentSnap, snapSettings.gridSnap],
  );
  const executeToggleGridSnap = useCallback((): void => {
    setSnapSettings((previous) => {
      const next = { ...previous, gridSnap: !previous.gridSnap };
      writeWorkspaceSnapSettings(next);
      return next;
    });
  }, []);
  const executeToggleAlignmentSnap = useCallback((): void => {
    setSnapSettings((previous) => {
      const next = { ...previous, alignmentSnap: !previous.alignmentSnap };
      writeWorkspaceSnapSettings(next);
      return next;
    });
  }, []);
  const executeSelectConnectionOrientation = useCallback(
    (orientation: WorkspaceStructuralConnectionOrientation): void => {
      setSnapSettings((previous) => {
        const next = { ...previous, structuralConnectionOrientation: orientation };
        writeWorkspaceSnapSettings(next);
        return next;
      });
    },
    [],
  );
  const executeResetWorkspace = useCallback((): void => {
    const layoutBeforeReset = readWorkspaceLayout(template.id);
    pushEditorHistorySnapshot({ template, layout: layoutBeforeReset });
    clearWorkspaceLayout(template.id);
    writeWorkspaceSnapSettings(DEFAULT_WORKSPACE_SNAP_SETTINGS);
    setSnapSettings(DEFAULT_WORKSPACE_SNAP_SETTINGS);
    refreshWorkspaceLayout();
    shouldFitViewAfterResetRef.current = true;
    notifySuccess('Workspace layout and canvas settings reset.');
  }, [pushEditorHistorySnapshot, refreshWorkspaceLayout, template]);
  const handleNodeDragStart = useCallback(
    (_event: React.MouseEvent, node: Node<WorkspaceNodeData>) => {
      captureLayoutBeforeInteraction();
      setDropTargetRoundId(null);
      setDraggingNodeId(node.id);
      if (node.data.kind === 'question') {
        isQuestionCrossRoundDragRef.current = true;
        setNodes((currentNodes) =>
          currentNodes.map((candidate) =>
            candidate.id === node.id ? detachQuestionNodeForDrag(candidate, currentNodes) : candidate,
          ),
        );
        return;
      }
      setNodes((currentNodes) =>
        currentNodes.map((candidate) =>
          candidate.id === node.id ? elevateNodeForDrag(candidate) : candidate,
        ),
      );
    },
    [captureLayoutBeforeInteraction, setNodes],
  );
  const handleNodeDragStop = useCallback(
    (event: React.MouseEvent, node: Node<WorkspaceNodeData>) => {
      setSnapGuides(null);
      setDropTargetRoundId(null);
      setDraggingNodeId(null);
      isQuestionCrossRoundDragRef.current = false;
      const dropPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const roundNodes = nodes.filter((candidate) => candidate.data.kind === 'round');
      if (node.data.kind === 'question' && node.data.questionId !== undefined) {
        const targetRoundId = resolveRoundIdAtFlowPosition({ flowPosition: dropPosition, roundNodes });
        const targetRoundNode =
          targetRoundId === null
            ? undefined
            : roundNodes.find((candidate) => candidate.data.roundId === targetRoundId);
        if (targetRoundId !== null && targetRoundId !== node.data.roundId && targetRoundNode !== undefined) {
          const questionId = node.data.questionId;
          const nextTemplate = moveQuestionToRound({ template, questionId, targetRoundId });
          const nextLayout = applyQuestionDropLayout({
            template: nextTemplate,
            layout: readWorkspaceLayout(template.id),
            roundId: targetRoundId,
            questionId,
            dropFlowPosition: node.position,
            roundNode: targetRoundNode,
          });
          commitWorkspaceLayout(nextLayout, { recordHistory: false });
          updateTemplate(() => nextTemplate);
          notifySuccess('Question moved to round.');
          return;
        }
      }
      const previousLayout = readCapturedLayoutBeforeInteraction();
      let settledNode = node;
      let onlyPersistNodeIds: ReadonlySet<string> | undefined;
      if (node.data.kind === 'round') {
        onlyPersistNodeIds = new Set([node.id]);
      }
      if (node.data.kind === 'question' && node.parentId === undefined && node.data.roundId !== undefined) {
        const roundNode = nodes.find((candidate) => candidate.id === buildRoundNodeId(node.data.roundId));
        if (roundNode !== undefined && node.data.questionId !== undefined) {
          const newQuestionRelative = clampRoundChildPosition({
            x: node.position.x - roundNode.position.x,
            y: node.position.y - roundNode.position.y,
          });
          const layoutBeforeDrag =
            previousLayout ?? readWorkspaceLayout(template.id) ?? { nodes: {} };
          const nextLayout = applyQuestionSameRoundMoveLayout({
            template,
            layout: readWorkspaceLayout(template.id),
            previousLayout: layoutBeforeDrag,
            roundId: node.data.roundId,
            questionId: node.data.questionId,
            newQuestionRelative,
          });
          commitWorkspaceLayout(nextLayout, { recordHistory: false });
          settledNode = reattachQuestionNodeAtRelativePosition({
            node,
            roundNode,
            relativePosition: newQuestionRelative,
          });
          const movedQuestion = template.rounds
            .find((round) => round.id === node.data.roundId)
            ?.questions.find((question) => question.id === node.data.questionId);
          if (movedQuestion !== undefined) {
            onlyPersistNodeIds = new Set(collectWorkspaceNodeIdsForMovedQuestion(movedQuestion));
          }
        }
      } else if (node.parentId !== undefined) {
        settledNode = { ...node, position: clampRoundChildPosition(node.position) };
        onlyPersistNodeIds = new Set([node.id]);
      }
      setNodes((currentNodes) => {
        const withSettledNode = currentNodes.map((candidate) =>
          candidate.id === node.id ? settledNode : candidate,
        );
        return applyRoundFitDimensionsToNodes(withSettledNode, template);
      });
      pendingLayoutCommitRef.current = { previousLayout, onlyPersistNodeIds };
    },
    [commitWorkspaceLayout, nodes, readCapturedLayoutBeforeInteraction, screenToFlowPosition, setNodes, template, updateTemplate],
  );
  const selectedNodeId = useMemo(
    () => resolveSelectedNodeId(selection, template),
    [selection, template],
  );
  const decoratedNodes = useMemo(() => {
    const orderedNodes = orderNodesForDragRender(nodes, draggingNodeId);
    return orderedNodes.map((node) => {
      const isDragging = node.id === draggingNodeId;
      const isDropTarget =
        node.data.kind === 'round' &&
        node.data.roundId !== undefined &&
        node.data.roundId === dropTargetRoundId;
      return {
        ...node,
        selected: node.id === selectedNodeId,
        zIndex: isDragging ? WORKSPACE_DRAGGING_Z_INDEX : node.zIndex,
        className: cn(node.className, isDropTarget && 'ring-2 ring-sky-400 ring-offset-2 ring-offset-background'),
        style: {
          ...node.style,
          opacity: searchQuery.trim().length > 0 && !matchingNodeIds.includes(node.id) ? 0.35 : 1,
        },
      };
    });
  }, [draggingNodeId, dropTargetRoundId, matchingNodeIds, nodes, searchQuery, selectedNodeId]);
  const handlePaneClick = useCallback((): void => {
    setSelection(null);
  }, [setSelection]);
  const handleSelectionChange: OnSelectionChangeFunc<Node<WorkspaceNodeData>> = useCallback(
    ({ nodes: selectedNodes }) => {
      if (selectedNodes.length === 0) {
        return;
      }
      const primaryNode = selectedNodes.at(-1);
      if (primaryNode === undefined) {
        return;
      }
      setSelection(selectionFromNodeId(primaryNode.id, template));
    },
    [setSelection, template],
  );
  return (
    <TooltipProvider delayDuration={300}>
    <WorkspaceCanvasSettingsProvider
      settings={{ structuralConnectionOrientation: snapSettings.structuralConnectionOrientation }}
    >
    <div className="flex h-full min-h-0 w-full flex-col lg:flex-row">
      <div className="relative min-h-0 min-w-0 flex-1">
        <ReactFlow
          nodes={decoratedNodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onReconnect={handleReconnect}
          edgesReconnectable
          onPaneClick={handlePaneClick}
          onSelectionChange={handleSelectionChange}
          onNodeClick={(_event, node) => setSelection(selectionFromNodeId(node.id, template))}
          onNodeDragStart={handleNodeDragStart}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={NODE_TYPES}
          minZoom={0.15}
          maxZoom={1.5}
          panOnScroll
          panOnScrollMode={PanOnScrollMode.Free}
          zoomOnScroll={false}
          zoomActivationKeyCode={['Meta', 'Shift']}
          className={cn('h-full w-full', WORKSPACE_CANVAS_CLASS)}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={WORKSPACE_SNAP_GRID_SIZE}
            size={1}
            color={readWorkspaceCanvasDotColor(isDark)}
          />
          <WorkspaceSnapGuides guides={snapGuides} />
          <Controls showInteractive={false} className={WORKSPACE_FLOW_CONTROLS_CLASS} />
          <MiniMap
            nodeColor={(node) => {
              const data = node.data as WorkspaceNodeData;
              if (data.kind === 'round') {
                return readWorkspaceMinimapNodeColor('round', isDark);
              }
              if (data.kind === 'question') {
                return readWorkspaceMinimapNodeColor('question', isDark);
              }
              return readWorkspaceMinimapNodeColor('default', isDark);
            }}
            className={WORKSPACE_MINIMAP_CLASS}
          />
        </ReactFlow>
        <div className="pointer-events-none absolute inset-0">
          <WorkspaceToolbar
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            isGridSnapEnabled={snapSettings.gridSnap}
            isAlignmentSnapEnabled={snapSettings.alignmentSnap}
            onToggleGridSnap={executeToggleGridSnap}
            onToggleAlignmentSnap={executeToggleAlignmentSnap}
            connectionOrientation={snapSettings.structuralConnectionOrientation}
            onSelectConnectionOrientation={executeSelectConnectionOrientation}
            onConfirmReset={executeResetWorkspace}
          />
          <div className="pointer-events-auto absolute right-3 top-3 z-10">
            <TemplateWorkspacePalette
              selectedRoundId={selectedRoundId}
              selectedQuestionId={selectedQuestionId}
              selectedOptionId={selectedOptionId}
            />
          </div>
        </div>
      </div>
      <TemplateWorkspaceInspector
        className={cn(
          'h-full min-h-0 w-full shrink-0 overflow-y-auto border-t lg:w-[min(100%,340px)] lg:border-l lg:border-t-0',
          WORKSPACE_PANEL_CLASS,
        )}
      />
    </div>
    </WorkspaceCanvasSettingsProvider>
    </TooltipProvider>
  );
}

export function TemplateWorkspace(): ReactElement {
  return (
    <ReactFlowProvider>
      <TemplateWorkspaceCanvas />
    </ReactFlowProvider>
  );
}
