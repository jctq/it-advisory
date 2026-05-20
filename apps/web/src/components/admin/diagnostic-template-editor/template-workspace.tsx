'use client';

import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Node,
  type NodeChange,
  type OnConnect,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
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
import type { WorkspaceStructuralConnectionOrientation } from '@/components/admin/diagnostic-template-editor/workspace-connection-orientation';
import { WorkspaceToolbar } from '@/components/admin/diagnostic-template-editor/workspace-toolbar';
import {
  buildDefaultVisibilityRuleForSource,
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
import { RoundGroupNode, WorkspaceCardNode } from '@/components/admin/diagnostic-template-editor/workspace-nodes';
import {
  clearWorkspaceLayout,
  DEFAULT_WORKSPACE_SNAP_SETTINGS,
  pruneWorkspaceLayoutNodeIds,
  readWorkspaceLayout,
  readWorkspaceSnapSettings,
  writeWorkspaceLayout,
  writeWorkspaceSnapSettings,
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

function TemplateWorkspaceCanvas(): ReactElement {
  const { template, updateTemplate, setSelection, selection } = useTemplateEditor();
  const { isDark } = useWorkspaceAppearance();
  const { fitView } = useReactFlow();
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [snapSettings, setSnapSettings] = useState<WorkspaceSnapSettings>(() => readWorkspaceSnapSettings());
  const [snapGuides, setSnapGuides] = useState<SnapGuideLines | null>(null);
  const [layoutRevision, setLayoutRevision] = useState<number>(0);
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
  useEffect(() => {
    shouldFitViewOnTemplateLoadRef.current = true;
  }, [template.id]);
  useEffect(() => {
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
    (nextNodes: readonly Node<WorkspaceNodeData>[], resizedNodeIds: ReadonlySet<string> = new Set()) => {
      const existingLayout = readWorkspaceLayout(template.id);
      const userSizedNodeIds = new Set<string>(resizedNodeIds);
      if (existingLayout !== null) {
        for (const [nodeId, entry] of Object.entries(existingLayout.nodes)) {
          if (entry.userSized === true) {
            userSizedNodeIds.add(nodeId);
          }
        }
      }
      writeWorkspaceLayout(template.id, collectLayoutFromNodes(nextNodes, { userSizedNodeIds }));
      setLayoutRevision((revision) => revision + 1);
    },
    [template.id],
  );
  const handleNodesChange = useCallback(
    (changes: NodeChange<Node<WorkspaceNodeData>>[]) => {
      const removalChanges = changes.filter(
        (change): change is NodeChange<Node<WorkspaceNodeData>> & { type: 'remove'; id: string } =>
          change.type === 'remove',
      );
      const nonRemovalChanges = changes.filter((change) => change.type !== 'remove');
      if (removalChanges.length > 0) {
        const { template: nextTemplate, prunedLayoutNodeIds } = applyWorkspaceNodeRemovals({
          template,
          removedNodeIds: removalChanges.map((change) => change.id),
        });
        updateTemplate(() => nextTemplate, { shouldReindex: false });
        pruneWorkspaceLayoutNodeIds(template.id, prunedLayoutNodeIds);
        setLayoutRevision((revision) => revision + 1);
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
      const hasFinishedResize = nonRemovalChanges.some(
        (change) => change.type === 'dimensions' && change.resizing === false,
      );
      if (!hasFinishedResize) {
        return;
      }
      const resizedNodeIds = new Set(
        nonRemovalChanges
          .filter((change): change is NodeChange<Node<WorkspaceNodeData>> & { type: 'dimensions'; id: string; resizing: false } =>
            change.type === 'dimensions' && change.resizing === false,
          )
          .map((change) => change.id),
      );
      window.requestAnimationFrame(() => {
        setNodes((currentNodes) => {
          persistLayout(currentNodes, resizedNodeIds);
          return currentNodes;
        });
      });
    },
    [onNodesChange, persistLayout, selection, setLayoutRevision, setNodes, setSelection, template, updateTemplate],
  );
  const handleConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (connection.source === null || connection.target === null) {
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
  const handleNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node<WorkspaceNodeData>) => {
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
        node.parentId === undefined ? snapResult.position : clampRoundChildPosition(snapResult.position);
      setNodes((currentNodes) =>
        currentNodes.map((candidate) =>
          candidate.id === node.id ? { ...candidate, position: nextPosition } : candidate,
        ),
      );
    },
    [nodes, setNodes, snapSettings.alignmentSnap, snapSettings.gridSnap],
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
    clearWorkspaceLayout(template.id);
    writeWorkspaceSnapSettings(DEFAULT_WORKSPACE_SNAP_SETTINGS);
    setSnapSettings(DEFAULT_WORKSPACE_SNAP_SETTINGS);
    setLayoutRevision((revision) => revision + 1);
    shouldFitViewAfterResetRef.current = true;
    notifySuccess('Workspace layout and canvas settings reset.');
  }, [template.id]);
  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node<WorkspaceNodeData>) => {
      setSnapGuides(null);
      const clampedNode =
        node.parentId === undefined
          ? node
          : { ...node, position: clampRoundChildPosition(node.position) };
      setNodes((currentNodes) => {
        const nextNodes = currentNodes.map((candidate) => (candidate.id === node.id ? clampedNode : candidate));
        persistLayout(nextNodes);
        return nextNodes;
      });
      if (clampedNode.data.kind !== 'question') {
        return;
      }
      const questionId = clampedNode.data.questionId;
      if (questionId === undefined) {
        return;
      }
      const roundNodes = nodes.filter((candidate) => candidate.data.kind === 'round');
      const absoluteCenter = {
        x:
          (clampedNode.parentId ? nodes.find((parent) => parent.id === clampedNode.parentId)?.position.x ?? 0 : 0) +
          clampedNode.position.x +
          80,
        y:
          (clampedNode.parentId ? nodes.find((parent) => parent.id === clampedNode.parentId)?.position.y ?? 0 : 0) +
          clampedNode.position.y +
          24,
      };
      let targetRoundId: string | null = null;
      for (const roundNode of roundNodes) {
        const width = typeof roundNode.style?.width === 'number' ? roundNode.style.width : 520;
        const height = typeof roundNode.style?.height === 'number' ? roundNode.style.height : 220;
        const withinX = absoluteCenter.x >= roundNode.position.x && absoluteCenter.x <= roundNode.position.x + width;
        const withinY = absoluteCenter.y >= roundNode.position.y && absoluteCenter.y <= roundNode.position.y + height;
        if (withinX && withinY) {
          targetRoundId = roundNode.data.roundId;
        }
      }
      if (targetRoundId === null || targetRoundId === clampedNode.data.roundId) {
        return;
      }
      updateTemplate((current) => {
        let movedQuestion = null as (typeof current.rounds)[number]['questions'][number] | null;
        const roundsWithout = current.rounds.map((round) => {
          const question = round.questions.find((candidate) => candidate.id === questionId);
          if (question === undefined) {
            return round;
          }
          movedQuestion = question;
          return { ...round, questions: round.questions.filter((candidate) => candidate.id !== questionId) };
        });
        if (movedQuestion === null) {
          return current;
        }
        return {
          ...current,
          rounds: roundsWithout.map((round) =>
            round.id === targetRoundId ? { ...round, questions: [...round.questions, movedQuestion!] } : round,
          ),
        };
      });
    },
    [nodes, persistLayout, updateTemplate],
  );
  const decoratedNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        style: {
          ...node.style,
          opacity: searchQuery.trim().length > 0 && !matchingNodeIds.includes(node.id) ? 0.35 : 1,
        },
      })),
    [matchingNodeIds, nodes, searchQuery],
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
          onNodeClick={(_event, node) => setSelection(selectionFromNodeId(node.id, template))}
          onNodeDrag={handleNodeDrag}
          onNodeDragStop={handleNodeDragStop}
          nodeTypes={NODE_TYPES}
          minZoom={0.15}
          maxZoom={1.5}
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
