'use client';

import { type ReactNode } from 'react';
import { ChevronDown, LaptopMinimal, MoonStar, Palette, SunMedium } from 'lucide-react';
import {
  ADMIN_COLOR_MODE_OPTIONS,
  ADMIN_COLOR_THEME_OPTIONS,
  type AdminColorMode,
  type AdminColorTheme,
} from '@/lib/admin/admin-appearance';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type AdminAppearanceControlsProps = {
  readonly mode: AdminColorMode;
  readonly theme: AdminColorTheme;
  readonly onModeChange: (mode: AdminColorMode) => void;
  readonly onThemeChange: (theme: AdminColorTheme) => void;
  readonly className?: string;
  /** Compact single-menu layout for admin header toolbars. */
  readonly variant?: 'panel' | 'toolbar';
};

const THEME_SWATCH_CLASS: Record<AdminColorTheme, string> = {
  indigo: 'bg-[oklch(0.35_0.12_264)]',
  emerald: 'bg-[oklch(0.47_0.13_160)]',
  amber: 'bg-[oklch(0.62_0.13_74)]',
  rose: 'bg-[oklch(0.59_0.18_14)]',
};

function renderModeIcon(mode: AdminColorMode, className?: string): ReactNode {
  const iconClass = cn('size-4 shrink-0', className);
  if (mode === 'light') {
    return <SunMedium className={iconClass} aria-hidden />;
  }
  if (mode === 'dark') {
    return <MoonStar className={iconClass} aria-hidden />;
  }
  return <LaptopMinimal className={iconClass} aria-hidden />;
}

function resolveModeLabel(mode: AdminColorMode): string {
  return ADMIN_COLOR_MODE_OPTIONS.find((option) => option.value === mode)?.label ?? mode;
}

function resolveThemeLabel(theme: AdminColorTheme): string {
  return ADMIN_COLOR_THEME_OPTIONS.find((option) => option.value === theme)?.label ?? theme;
}

type AppearanceDropdownProps<T extends string> = {
  readonly ariaLabel: string;
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onValueChange: (value: T) => void;
  readonly renderTriggerIcon: () => ReactNode;
  readonly renderMenuIcon?: (value: T) => ReactNode;
  readonly triggerClassName?: string;
  readonly compact?: boolean;
};

function AppearanceDropdown<T extends string>(props: AppearanceDropdownProps<T>) {
  const selectedLabel = props.options.find((option) => option.value === props.value)?.label ?? props.value;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size={props.compact ? 'sm' : 'default'}
          aria-label={props.ariaLabel}
          className={cn(
            'appearance-dropdown-trigger justify-between gap-1.5 font-normal shadow-xs',
            props.compact
              ? 'h-9 min-w-0 shrink-0 px-2.5'
              : 'min-h-11 w-full min-w-[128px] gap-2 px-3',
            props.triggerClassName,
          )}
        >
          <span className="flex min-w-0 items-center gap-1.5">
            {props.renderTriggerIcon()}
            <span className={cn('truncate text-sm', props.compact && 'hidden md:inline')}>{selectedLabel}</span>
          </span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align={props.compact ? 'end' : 'start'}
        className={cn(
          props.compact ? 'w-40' : 'min-w-(--radix-dropdown-menu-trigger-width)',
        )}
      >
        <DropdownMenuRadioGroup
          value={props.value}
          onValueChange={(nextValue) => props.onValueChange(nextValue as T)}
        >
          {props.options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className="cursor-pointer gap-2">
              {props.renderMenuIcon ? props.renderMenuIcon(option.value) : null}
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AdminAppearanceToolbarMenu(props: AdminAppearanceControlsProps): ReactNode {
  const modeLabel = resolveModeLabel(props.mode);
  const themeLabel = resolveThemeLabel(props.theme);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={`Appearance: ${modeLabel}, ${themeLabel} accent`}
          className={cn(
            'h-9 shrink-0 gap-1.5 border-border/80 px-2.5 font-normal shadow-xs',
            props.className,
          )}
        >
          {renderModeIcon(props.mode, 'text-muted-foreground')}
          <span className="hidden max-w-18 truncate text-sm sm:inline">{modeLabel}</span>
          <span className="hidden text-muted-foreground/60 sm:inline" aria-hidden>
            ·
          </span>
          <span
            className={cn('size-2.5 shrink-0 rounded-full ring-1 ring-border/80', THEME_SWATCH_CLASS[props.theme])}
            aria-hidden
          />
          <span className="hidden max-w-18 truncate text-sm md:inline">{themeLabel}</span>
          <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Color mode</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={props.mode} onValueChange={(value) => props.onModeChange(value as AdminColorMode)}>
          {ADMIN_COLOR_MODE_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className="cursor-pointer gap-2">
              {renderModeIcon(option.value, 'text-muted-foreground')}
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs text-muted-foreground">Accent</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          value={props.theme}
          onValueChange={(value) => props.onThemeChange(value as AdminColorTheme)}
        >
          {ADMIN_COLOR_THEME_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className="cursor-pointer gap-2">
              <span
                className={cn('size-2.5 shrink-0 rounded-full ring-1 ring-border/60', THEME_SWATCH_CLASS[option.value])}
                aria-hidden
              />
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function AdminAppearancePanelControls(props: AdminAppearanceControlsProps): ReactNode {
  return (
    <div className={cn('flex flex-col items-stretch gap-3', props.className)}>
      <AppearanceDropdown
        ariaLabel="Color mode"
        value={props.mode}
        options={ADMIN_COLOR_MODE_OPTIONS}
        onValueChange={props.onModeChange}
        renderTriggerIcon={() => renderModeIcon(props.mode, 'text-muted-foreground')}
        renderMenuIcon={(value) => renderModeIcon(value, 'text-muted-foreground')}
      />
      <AppearanceDropdown
        ariaLabel="Color theme"
        value={props.theme}
        options={ADMIN_COLOR_THEME_OPTIONS}
        onValueChange={props.onThemeChange}
        renderTriggerIcon={() => <Palette className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        renderMenuIcon={(value) => (
          <span
            className={cn('size-2.5 shrink-0 rounded-full ring-1 ring-border/60', THEME_SWATCH_CLASS[value])}
            aria-hidden
          />
        )}
      />
    </div>
  );
}

export function AdminAppearanceControls(props: AdminAppearanceControlsProps) {
  const variant = props.variant ?? 'panel';
  if (variant === 'toolbar') {
    return <AdminAppearanceToolbarMenu {...props} />;
  }
  return <AdminAppearancePanelControls {...props} />;
}
