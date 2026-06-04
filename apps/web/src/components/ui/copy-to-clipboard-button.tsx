'use client';

import { Copy } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const COPIED_TOOLTIP_DURATION_MS = 3000;

type CopyToClipboardButtonProps = {
  readonly value: string;
  readonly ariaLabel?: string;
  readonly className?: string;
  readonly iconClassName?: string;
};

export function CopyToClipboardButton(props: CopyToClipboardButtonProps): ReactElement {
  const [isCopied, setIsCopied] = useState(false);
  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearCopiedTimeout = useCallback((): void => {
    if (copiedTimeoutRef.current !== null) {
      clearTimeout(copiedTimeoutRef.current);
      copiedTimeoutRef.current = null;
    }
  }, []);
  const executeCopy = useCallback((): void => {
    void navigator.clipboard.writeText(props.value).then(() => {
      clearCopiedTimeout();
      setIsCopied(true);
      copiedTimeoutRef.current = setTimeout(() => {
        setIsCopied(false);
        copiedTimeoutRef.current = null;
      }, COPIED_TOOLTIP_DURATION_MS);
    });
  }, [clearCopiedTimeout, props.value]);
  const handleTooltipOpenChange = useCallback((open: boolean): void => {
    if (!open) {
      clearCopiedTimeout();
      setIsCopied(false);
    }
  }, [clearCopiedTimeout]);
  useEffect(() => {
    return () => {
      clearCopiedTimeout();
    };
  }, [clearCopiedTimeout]);
  const ariaLabel = props.ariaLabel ?? 'Copy to clipboard';
  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={isCopied} onOpenChange={handleTooltipOpenChange}>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn('size-8 shrink-0 text-muted-foreground hover:text-foreground', props.className)}
            aria-label={isCopied ? 'Copied' : ariaLabel}
            onClick={executeCopy}
          >
            <Copy className={cn('size-3.5', props.iconClassName)} aria-hidden />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top">Copied</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
