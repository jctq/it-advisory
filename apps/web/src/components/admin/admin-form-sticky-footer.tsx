'use client';

import { Loader2, Save } from 'lucide-react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AdminFormStickyFooterProps = {
  readonly hint: string;
  readonly saveLabel: string;
  readonly isSaving: boolean;
  readonly isDisabled: boolean;
  readonly statusMessage: string | null;
  readonly onSave: () => void;
  readonly resetLabel?: string;
  readonly onReset?: () => void;
  readonly isResetDisabled?: boolean;
  readonly className?: string;
};

export function AdminFormStickyFooter(props: AdminFormStickyFooterProps): ReactElement {
  return (
    <div
      className={cn(
        'sticky bottom-0 z-20 border-t border-border bg-background/95 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_-16px_rgba(15,23,42,0.12)] backdrop-blur-md dark:shadow-[0_-12px_40px_-16px_rgba(0,0,0,0.45)]',
        props.className,
      )}
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{props.hint}</p>
          {props.statusMessage !== null ? (
            <p className="text-sm font-medium text-foreground" role="status">
              {props.statusMessage}
            </p>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {props.onReset !== undefined && props.resetLabel !== undefined ? (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="min-h-11"
              onClick={props.onReset}
              disabled={props.isSaving || props.isResetDisabled === true}
            >
              {props.resetLabel}
            </Button>
          ) : null}
          <Button
            type="button"
            size="lg"
            className="min-h-11 min-w-40 gap-2"
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
                {props.saveLabel}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
