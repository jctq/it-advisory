'use client';

import { Loader2, Save } from 'lucide-react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Bottom padding for scrollable content above {@link AdminFormStickyFooter}. */
export const adminFormStickyFooterScrollPaddingClass =
  'pb-[calc(env(safe-area-inset-bottom,0px)+5.5rem)] sm:pb-6';

type AdminFormStickyFooterProps = {
  readonly saveLabel?: string;
  readonly isSaving: boolean;
  readonly isDisabled: boolean;
  readonly onSave: () => void;
  readonly resetLabel?: string;
  readonly onReset?: () => void;
  readonly isResetDisabled?: boolean;
  readonly className?: string;
};

export function AdminFormStickyFooter(props: AdminFormStickyFooterProps): ReactElement {
  const hasReset = props.onReset !== undefined;
  const saveLabel = props.saveLabel ?? 'Save';
  const resetLabel = props.resetLabel ?? 'Reset';
  return (
    <div
      className={cn(
        'fixed bottom-0 left-[var(--admin-sidebar-width,0px)] right-0 z-20 border-t border-border/80 bg-background pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_32px_-8px_rgba(15,23,42,0.18)] backdrop-blur-md supports-backdrop-filter:bg-background/95 dark:shadow-[0_-8px_32px_-8px_rgba(0,0,0,0.55)]',
        props.className,
      )}
    >
      <div className="mx-auto flex max-w-5xl items-center justify-end gap-2 px-3 py-3 sm:px-6 sm:py-4">
        {hasReset ? (
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-11 min-w-0 flex-1 touch-manipulation px-3 text-sm sm:flex-none sm:w-auto"
            onClick={props.onReset}
            disabled={props.isSaving || props.isResetDisabled === true}
          >
            {resetLabel}
          </Button>
        ) : null}
        <Button
          type="button"
          size="lg"
          className={cn(
            'min-h-11 min-w-0 touch-manipulation gap-2 px-3 text-sm',
            hasReset ? 'flex-[1.2]' : 'w-full sm:w-auto',
            'sm:min-w-40 sm:flex-none',
          )}
          onClick={props.onSave}
          disabled={props.isDisabled}
        >
          {props.isSaving ? (
            <>
              <Loader2 className="size-4 shrink-0 animate-spin" aria-hidden />
              Saving…
            </>
          ) : (
            <>
              <Save className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{saveLabel}</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
