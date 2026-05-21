'use client';

import { Search } from 'lucide-react';
import type { ReactElement } from 'react';
import { WorkspaceConnectionControls } from '@/components/admin/diagnostic-template-editor/workspace-connection-controls';
import { WorkspaceEdgeLegendPopover } from '@/components/admin/diagnostic-template-editor/workspace-edge-legend';
import { WorkspaceOperationGuideDialog } from '@/components/admin/diagnostic-template-editor/workspace-operation-guide-dialog';
import { WorkspaceFullscreenToggle } from '@/components/admin/diagnostic-template-editor/workspace-fullscreen-toggle';
import { WorkspaceResetDialog } from '@/components/admin/diagnostic-template-editor/workspace-reset-dialog';
import { WorkspaceSnapControls } from '@/components/admin/diagnostic-template-editor/workspace-snap-controls';
import type { WorkspaceStructuralConnectionOrientation } from '@/components/admin/diagnostic-template-editor/workspace-connection-orientation';
import {
  WORKSPACE_CHROME_DIVIDER_CLASS,
  WORKSPACE_CHROME_INPUT_CLASS,
  WORKSPACE_CHROME_MUTED_TEXT_CLASS,
  WORKSPACE_CHROME_SHELL_CLASS,
} from '@/components/admin/diagnostic-template-editor/workspace-theme';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type WorkspaceToolbarProps = {
  readonly searchQuery: string;
  readonly onSearchQueryChange: (query: string) => void;
  readonly isGridSnapEnabled: boolean;
  readonly isAlignmentSnapEnabled: boolean;
  readonly onToggleGridSnap: () => void;
  readonly onToggleAlignmentSnap: () => void;
  readonly connectionOrientation: WorkspaceStructuralConnectionOrientation;
  readonly onSelectConnectionOrientation: (orientation: WorkspaceStructuralConnectionOrientation) => void;
  readonly onConfirmReset: () => void;
};

export function WorkspaceToolbar(props: WorkspaceToolbarProps): ReactElement {
  return (
    <div
      className={cn(
        'pointer-events-auto absolute left-3 top-3 z-10 flex max-w-[min(100%-7rem,42rem)] items-center gap-0.5 rounded-lg p-0.5',
        WORKSPACE_CHROME_SHELL_CLASS,
      )}
    >
      <div className="relative w-28 shrink-0 sm:w-32">
        <Search
          className={cn(
            'pointer-events-none absolute left-2 top-1/2 size-3 -translate-y-1/2',
            WORKSPACE_CHROME_MUTED_TEXT_CLASS,
          )}
          aria-hidden
        />
        <Input
          value={props.searchQuery}
          onChange={(event) => props.onSearchQueryChange(event.target.value)}
          placeholder="Search…"
          className={cn('h-7 pl-7 pr-1 text-[11px]', WORKSPACE_CHROME_INPUT_CLASS)}
          aria-label="Search workspace nodes"
        />
      </div>
      <span className={cn('h-4 w-px shrink-0', WORKSPACE_CHROME_DIVIDER_CLASS)} aria-hidden />
      <WorkspaceSnapControls
        compact
        isGridSnapEnabled={props.isGridSnapEnabled}
        isAlignmentSnapEnabled={props.isAlignmentSnapEnabled}
        onToggleGridSnap={props.onToggleGridSnap}
        onToggleAlignmentSnap={props.onToggleAlignmentSnap}
      />
      <span className={cn('h-4 w-px shrink-0', WORKSPACE_CHROME_DIVIDER_CLASS)} aria-hidden />
      <WorkspaceConnectionControls
        compact
        orientation={props.connectionOrientation}
        onSelectOrientation={props.onSelectConnectionOrientation}
      />
      <span className={cn('h-4 w-px shrink-0', WORKSPACE_CHROME_DIVIDER_CLASS)} aria-hidden />
      <WorkspaceEdgeLegendPopover />
      <WorkspaceOperationGuideDialog compact />
      <WorkspaceResetDialog compact onConfirmReset={props.onConfirmReset} />
      <span className={cn('h-4 w-px shrink-0', WORKSPACE_CHROME_DIVIDER_CLASS)} aria-hidden />
      <WorkspaceFullscreenToggle compact />
    </div>
  );
}
