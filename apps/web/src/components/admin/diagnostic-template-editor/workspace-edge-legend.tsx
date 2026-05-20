'use client';

import { Info } from 'lucide-react';
import type { ReactElement } from 'react';
import { useWorkspaceAppearance } from '@/components/admin/diagnostic-template-editor/use-workspace-appearance';
import { WorkspaceTooltip } from '@/components/admin/diagnostic-template-editor/workspace-tooltip';
import {
  WORKSPACE_CHROME_BUTTON_CLASS,
  WORKSPACE_CHROME_MUTED_TEXT_CLASS,
  WORKSPACE_CHROME_SHELL_CLASS,
  WORKSPACE_CHROME_TEXT_CLASS,
  WORKSPACE_EDGE_LEGEND_ITEMS,
  readWorkspaceLegendSwatchColor,
} from '@/components/admin/diagnostic-template-editor/workspace-theme';
import { cn } from '@/lib/utils';

function WorkspaceEdgeLegendContent(): ReactElement {
  const { isDark } = useWorkspaceAppearance();
  return (
    <ul className={cn('space-y-1 text-[10px]', WORKSPACE_CHROME_TEXT_CLASS)}>
      {WORKSPACE_EDGE_LEGEND_ITEMS.map((item) => (
        <li key={item.label} className="flex items-center gap-2 whitespace-nowrap">
          <span
            className="inline-block h-0.5 w-4 shrink-0 rounded-full"
            style={{
              backgroundColor: item.dashed ? 'transparent' : readWorkspaceLegendSwatchColor(item.kind, isDark),
              borderTop: item.dashed ? `2px dashed ${readWorkspaceLegendSwatchColor(item.kind, isDark)}` : undefined,
            }}
            aria-hidden
          />
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function WorkspaceEdgeLegendPopover(): ReactElement {
  return (
    <details className="relative">
      <summary
        aria-label="Connection legend"
        className="list-none [&::-webkit-details-marker]:hidden"
      >
        <WorkspaceTooltip label="Connection legend">
          <span
            className={cn(
              'flex size-7 cursor-pointer items-center justify-center rounded-md',
              WORKSPACE_CHROME_MUTED_TEXT_CLASS,
              WORKSPACE_CHROME_BUTTON_CLASS,
            )}
          >
            <Info className="size-3.5" aria-hidden />
          </span>
        </WorkspaceTooltip>
      </summary>
      <div
        className={cn(
          'absolute left-0 top-full z-20 mt-1 rounded-md px-2.5 py-2',
          WORKSPACE_CHROME_SHELL_CLASS,
          'min-w-[10.5rem]',
        )}
        role="region"
        aria-label="Edge legend"
      >
        <p className={cn('mb-1 text-[9px] font-semibold uppercase tracking-wide', WORKSPACE_CHROME_MUTED_TEXT_CLASS)}>
          Connections
        </p>
        <WorkspaceEdgeLegendContent />
      </div>
    </details>
  );
}
