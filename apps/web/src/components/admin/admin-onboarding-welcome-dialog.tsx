'use client';

import { CircleHelp, Map, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type AdminOnboardingWelcomeDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onStartTour: () => void;
  readonly onDismiss: () => void;
};

const WELCOME_TIPS: readonly { readonly title: string; readonly description: string }[] = [
  {
    title: 'Every workspace page',
    description: 'The tour navigates to each admin route and highlights tables, calendars, and settings in context.',
  },
  {
    title: 'Appearance controls',
    description: 'Light, dark, or system mode plus accent colors in the top bar.',
  },
  {
    title: 'Replay anytime',
    description: 'Use the guide button next to appearance settings to run the tour again.',
  },
] as const;

export function AdminOnboardingWelcomeDialog(props: AdminOnboardingWelcomeDialogProps) {
  const executeOpenChange = (open: boolean): void => {
    if (!open) {
      props.onDismiss();
      return;
    }
    props.onOpenChange(open);
  };
  return (
    <Dialog open={props.open} onOpenChange={executeOpenChange}>
      <DialogContent className="max-w-lg gap-0 p-0 overflow-hidden" showCloseButton>
        <div className="border-b border-border/80 bg-muted/40 px-6 py-5">
          <DialogHeader className="space-y-3 text-left">
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <DialogTitle className="text-xl">Welcome to the admin console</DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              A guided tour walks through the sidebar, then visits each workspace page—dashboard, templates, blog,
              sessions, and settings—with tips on the key controls in each area.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="space-y-3 px-6 py-5">
          {WELCOME_TIPS.map((tip) => (
            <div
              key={tip.title}
              className="flex gap-3 rounded-xl border border-border/80 bg-background px-3 py-3"
            >
              <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Map className="size-4" aria-hidden />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{tip.title}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{tip.description}</p>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="flex-col gap-2 border-t border-border/80 bg-muted/20 px-6 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" className="w-full sm:w-auto" onClick={props.onDismiss}>
            Maybe later
          </Button>
          <Button type="button" className="w-full gap-2 sm:w-auto" onClick={props.onStartTour}>
            <CircleHelp className="size-4" aria-hidden />
            Start guided tour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
