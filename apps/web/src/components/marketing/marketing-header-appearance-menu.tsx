'use client';

import { Palette } from 'lucide-react';
import { type ReactElement } from 'react';
import { AdminAppearanceControls } from '@/components/admin/admin-appearance-controls';
import type { AdminColorMode, AdminColorTheme } from '@/lib/admin/admin-appearance';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            'h-10 gap-2 border-border/80 bg-background/60 px-3 text-muted-foreground shadow-none backdrop-blur-sm hover:bg-muted/50 hover:text-foreground',
            props.className,
          )}
          aria-label="Theme and display settings"
        >
          <Palette className="size-4 shrink-0 text-primary" aria-hidden />
          <span className="hidden max-w-[8rem] truncate text-sm font-medium capitalize sm:inline" aria-hidden>
            Theme
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-[min(calc(100vw-2rem),18rem)] rounded-xl p-3"
      >
        <p className="mb-3 border-b border-border/60 pb-2 text-xs font-medium text-muted-foreground">
          Display & accent
        </p>
        <AdminAppearanceControls
          mode={props.colorMode}
          theme={props.colorTheme}
          onModeChange={props.onModeChange}
          onThemeChange={props.onThemeChange}
          className="flex-col items-stretch gap-3 [&_.appearance-dropdown-trigger]:w-full"
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
