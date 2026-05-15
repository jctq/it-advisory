'use client';

import { Palette } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { AdminAppearanceControls } from '@/components/admin/admin-appearance-controls';
import type { AdminColorMode, AdminColorTheme } from '@/lib/admin/admin-appearance';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type MarketingHeaderAppearanceMenuProps = {
  readonly colorMode: AdminColorMode;
  readonly colorTheme: AdminColorTheme;
  readonly onModeChange: (mode: AdminColorMode) => void;
  readonly onThemeChange: (theme: AdminColorTheme) => void;
  readonly className?: string;
};

/**
 * Compact theme controls for the marketing header — one trigger instead of two full-width selects.
 */
export function MarketingHeaderAppearanceMenu(props: MarketingHeaderAppearanceMenuProps): ReactElement {
  const [open, setOpen] = useState<boolean>(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) {
      return;
    }
    const executeHandleEscape = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('keydown', executeHandleEscape);
    return () => {
      document.removeEventListener('keydown', executeHandleEscape);
    };
  }, [open]);
  useEffect(() => {
    if (!open) {
      return;
    }
    const executeHandlePointerDown = (event: PointerEvent): void => {
      if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', executeHandlePointerDown);
    return () => {
      document.removeEventListener('pointerdown', executeHandlePointerDown);
    };
  }, [open]);
  return (
    <div ref={rootRef} className={cn('relative', props.className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10 gap-2 border-border/80 bg-background/60 px-3 text-muted-foreground shadow-none backdrop-blur-sm hover:bg-muted/50 hover:text-foreground"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-controls="marketing-header-theme-panel"
        aria-label="Theme and display settings"
        onClick={() => setOpen((value) => !value)}
      >
        <Palette className="size-4 shrink-0 text-primary" aria-hidden />
        <span className="hidden max-w-[8rem] truncate text-sm font-medium capitalize sm:inline" aria-hidden>
          Theme
        </span>
      </Button>
      {open ? (
        <div
          id="marketing-header-theme-panel"
          role="dialog"
          aria-label="Theme and display settings"
          className="absolute right-0 z-50 mt-2 w-[min(calc(100vw-2rem),18rem)] rounded-xl border border-border bg-popover p-3 shadow-lg"
        >
          <p className="mb-3 border-b border-border/60 pb-2 text-xs font-medium text-muted-foreground">
            Display & accent
          </p>
          <AdminAppearanceControls
            mode={props.colorMode}
            theme={props.colorTheme}
            onModeChange={props.onModeChange}
            onThemeChange={props.onThemeChange}
            className="flex-col items-stretch gap-3 [&_label]:min-w-0 [&_label]:w-full [&_select]:w-full"
          />
        </div>
      ) : null}
    </div>
  );
}
