'use client';

import { RotateCcw } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { WorkspaceTooltip } from '@/components/admin/diagnostic-template-editor/workspace-tooltip';
import { Button } from '@/components/ui/button';
import {
  WORKSPACE_CHROME_BUTTON_CLASS,
  WORKSPACE_CHROME_MUTED_TEXT_CLASS,
} from '@/components/admin/diagnostic-template-editor/workspace-theme';
import { cn } from '@/lib/utils';

type WorkspaceResetDialogProps = {
  readonly onConfirmReset: () => void;
  readonly compact?: boolean;
};

export function WorkspaceResetDialog(props: WorkspaceResetDialogProps): ReactElement {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const isCompact = props.compact === true;
  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <WorkspaceTooltip label="Reset workspace layout and canvas settings">
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            size={isCompact ? 'icon' : 'sm'}
            variant="ghost"
            aria-label="Reset workspace"
            className={cn(WORKSPACE_CHROME_BUTTON_CLASS, isCompact ? 'size-7 shrink-0' : 'h-8 gap-1.5 px-2 text-xs')}
          >
            <RotateCcw className="size-3.5 shrink-0" aria-hidden />
            {isCompact ? null : 'Reset workspace'}
          </Button>
        </AlertDialogTrigger>
      </WorkspaceTooltip>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reset workspace?</AlertDialogTitle>
          <AlertDialogDescription className={WORKSPACE_CHROME_MUTED_TEXT_CLASS}>
            This clears saved node positions and sizes, restores default grid snap and connection orientation, and
            re-runs auto-layout. Template content edits are not reverted — use Undo for those.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-amber-600 text-white hover:bg-amber-500"
            onClick={() => {
              props.onConfirmReset();
              setIsOpen(false);
            }}
          >
            Reset workspace
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
