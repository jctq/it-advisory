'use client';

import { HelpCircle } from 'lucide-react';
import { useRef, useState, type ReactElement, type ReactNode } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export type AdminSettingsHintProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly side?: 'top' | 'right' | 'bottom' | 'left';
  readonly align?: 'start' | 'center' | 'end';
};

export function AdminSettingsHint(props: AdminSettingsHintProps): ReactElement {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const hoverDepthRef = useRef<number>(0);
  const scheduleClose = (): void => {
    window.setTimeout(() => {
      if (hoverDepthRef.current === 0) {
        setIsOpen(false);
      }
    }, 80);
  };
  const handlePointerEnter = (): void => {
    hoverDepthRef.current += 1;
    setIsOpen(true);
  };
  const handlePointerLeave = (): void => {
    hoverDepthRef.current = Math.max(0, hoverDepthRef.current - 1);
    scheduleClose();
  };
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
            props.className,
          )}
          aria-label="Show tip"
          onPointerEnter={handlePointerEnter}
          onPointerLeave={handlePointerLeave}
          onClick={(event) => {
            event.preventDefault();
            setIsOpen((previous) => !previous);
          }}
        >
          <HelpCircle className="size-3.5" strokeWidth={2} aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={props.side ?? 'top'}
        align={props.align ?? 'start'}
        className="max-w-sm p-3 text-xs leading-relaxed text-popover-foreground"
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
      >
        {props.children}
      </PopoverContent>
    </Popover>
  );
}

export type AdminSettingsLabelProps = {
  readonly htmlFor?: string;
  readonly children: ReactNode;
  readonly hint?: ReactNode;
  readonly className?: string;
};

export function AdminSettingsLabel(props: AdminSettingsLabelProps): ReactElement {
  if (props.hint === undefined) {
    return (
      <label htmlFor={props.htmlFor} className={cn('text-sm font-medium text-foreground', props.className)}>
        {props.children}
      </label>
    );
  }
  return (
    <div className={cn('flex items-center gap-1.5', props.className)}>
      <label htmlFor={props.htmlFor} className="text-sm font-medium text-foreground">
        {props.children}
      </label>
      <AdminSettingsHint>{props.hint}</AdminSettingsHint>
    </div>
  );
}

export type AdminSettingsOptionTitleProps = {
  readonly children: ReactNode;
  readonly hint: ReactNode;
  readonly className?: string;
};

export function AdminSettingsOptionTitle(props: AdminSettingsOptionTitleProps): ReactElement {
  return (
    <div className={cn('flex items-start gap-1.5', props.className)}>
      <p className="text-sm font-medium text-foreground">{props.children}</p>
      <AdminSettingsHint side="top" className="mt-0.5">
        {props.hint}
      </AdminSettingsHint>
    </div>
  );
}
