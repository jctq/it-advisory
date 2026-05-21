'use client';

import { BookOpen } from 'lucide-react';
import { useState, type ReactElement } from 'react';
import {
  AddOptionGuideIllustration,
  AddQuestionGuideIllustration,
  AddRoundGuideIllustration,
  MoveQuestionBetweenRoundsGuideIllustration,
  ReorderQuestionGuideIllustration,
  ReorderRoundGuideIllustration,
} from '@/components/admin/diagnostic-template-editor/workspace-operation-guide-illustrations';
import { WorkspaceTooltip } from '@/components/admin/diagnostic-template-editor/workspace-tooltip';
import {
  WORKSPACE_CHROME_BUTTON_CLASS,
  WORKSPACE_CHROME_MUTED_TEXT_CLASS,
  WORKSPACE_CHROME_SHELL_CLASS,
} from '@/components/admin/diagnostic-template-editor/workspace-theme';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

type WorkspaceOperationGuideEntry = {
  readonly id: string;
  readonly title: string;
  readonly summary: string;
  readonly steps: readonly string[];
  readonly Illustration: (props: { readonly className?: string }) => ReactElement;
};

const WORKSPACE_OPERATION_GUIDES: readonly WorkspaceOperationGuideEntry[] = [
  {
    id: 'add-round',
    title: 'Add a round',
    summary: 'Creates a new customer-facing round on the canvas.',
    steps: [
      'Click the stacked-layers button in the top-right palette (Add round).',
      'A new round card appears on the canvas and is selected automatically.',
      'Edit the round title and guidance in the inspector on the right.',
    ],
    Illustration: AddRoundGuideIllustration,
  },
  {
    id: 'add-question',
    title: 'Add a question',
    summary: 'Adds a question inside the selected round.',
    steps: [
      'Click a round card on the canvas to select it (or click empty space, then select a round).',
      'Click the message-square button in the top-right palette (Add question).',
      'The new question appears inside that round; edit its prompt in the inspector.',
    ],
    Illustration: AddQuestionGuideIllustration,
  },
  {
    id: 'add-option',
    title: 'Add an option',
    summary: 'Adds an answer choice to the selected question.',
    steps: [
      'Click a question card inside a round to select it.',
      'Click the checklist button in the top-right palette (Add option).',
      'The option card is linked to the question; edit its label in the inspector.',
    ],
    Illustration: AddOptionGuideIllustration,
  },
  {
    id: 'reorder-round',
    title: 'Reorder rounds',
    summary: 'Changes the order customers experience rounds (R1, R2, …).',
    steps: [
      'Select a round card on the canvas.',
      'In the right inspector, find the Customer flow order section.',
      'Use Move earlier or Move later to shift that round in the sequence.',
    ],
    Illustration: ReorderRoundGuideIllustration,
  },
  {
    id: 'reorder-question',
    title: 'Reorder questions',
    summary: 'Changes question order within a round (and can move across rounds).',
    steps: [
      'Locate the dashed line between two question cards (question order connection).',
      'Hover the line or its endpoint — the cursor becomes the move icon (four arrows), then drag.',
      'Reconnect to another question card; the follower moves after that question and a toast confirms.',
    ],
    Illustration: ReorderQuestionGuideIllustration,
  },
  {
    id: 'move-question-between-rounds',
    title: 'Move a question between rounds',
    summary: 'Moves a question (and its options) into a different round.',
    steps: [
      'Drag a question card by its body (not the order line).',
      'Hover over another round — it highlights with a sky ring when it can receive the drop.',
      'Release over that round; the question moves there and layout updates automatically.',
    ],
    Illustration: MoveQuestionBetweenRoundsGuideIllustration,
  },
];

type WorkspaceOperationGuideDialogProps = {
  readonly compact?: boolean;
};

export function WorkspaceOperationGuideDialog(props: WorkspaceOperationGuideDialogProps): ReactElement {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const isCompact = props.compact === true;
  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <WorkspaceTooltip label="Workspace operation guide">
        <DialogTrigger asChild>
          <Button
            type="button"
            size={isCompact ? 'icon' : 'sm'}
            variant="ghost"
            aria-label="Workspace operation guide"
            className={cn(WORKSPACE_CHROME_BUTTON_CLASS, isCompact ? 'size-7 shrink-0' : 'h-8 gap-1.5 px-2 text-xs')}
          >
            <BookOpen className="size-3.5 shrink-0" aria-hidden />
            {isCompact ? null : 'Guide'}
          </Button>
        </DialogTrigger>
      </WorkspaceTooltip>
      <DialogContent className="flex max-h-[min(90dvh,720px)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b px-6 py-4 text-left">
          <DialogTitle>Workspace operation guide</DialogTitle>
          <DialogDescription className={WORKSPACE_CHROME_MUTED_TEXT_CLASS}>
            How to build and rearrange rounds, questions, and options on the diagnostic template canvas.
          </DialogDescription>
        </DialogHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          <ol className="space-y-8">
            {WORKSPACE_OPERATION_GUIDES.map((guide, index) => (
              <li key={guide.id} className="scroll-mt-4">
                <article className={cn('rounded-xl border p-4', WORKSPACE_CHROME_SHELL_CLASS)}>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <guide.Illustration className="mx-auto w-full max-w-[280px] shrink-0 sm:mx-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Step {index + 1}
                      </p>
                      <h3 className="mt-0.5 text-base font-semibold text-foreground">{guide.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{guide.summary}</p>
                      <ol className="mt-3 list-decimal space-y-1.5 pl-4 text-sm text-foreground">
                        {guide.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  </div>
                </article>
              </li>
            ))}
          </ol>
        </div>
      </DialogContent>
    </Dialog>
  );
}
