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
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type AdminAppearanceControlsProps = {
  readonly mode: AdminColorMode;
  readonly theme: AdminColorTheme;
  readonly onModeChange: (mode: AdminColorMode) => void;
  readonly onThemeChange: (theme: AdminColorTheme) => void;
  readonly className?: string;
};

function renderModeIcon(mode: AdminColorMode) {
  if (mode === 'light') {
    return <SunMedium className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
  }
  if (mode === 'dark') {
    return <MoonStar className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
  }
  return <LaptopMinimal className="size-4 shrink-0 text-muted-foreground" aria-hidden />;
}

type AppearanceDropdownProps<T extends string> = {
  readonly ariaLabel: string;
  readonly value: T;
  readonly options: readonly { readonly value: T; readonly label: string }[];
  readonly onValueChange: (value: T) => void;
  readonly renderIcon: () => ReactNode;
  readonly triggerClassName?: string;
};

function AppearanceDropdown<T extends string>(props: AppearanceDropdownProps<T>) {
  const selectedLabel = props.options.find((option) => option.value === props.value)?.label ?? props.value;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-label={props.ariaLabel}
          className={cn(
            'appearance-dropdown-trigger min-h-11 w-full min-w-[128px] justify-between gap-2 px-3 font-normal shadow-xs',
            props.triggerClassName,
          )}
        >
          <span className="flex min-w-0 items-center gap-2">
            {props.renderIcon()}
            <span className="truncate text-sm">{selectedLabel}</span>
          </span>
          <ChevronDown className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-(--radix-dropdown-menu-trigger-width)">
        <DropdownMenuRadioGroup
          value={props.value}
          onValueChange={(nextValue) => props.onValueChange(nextValue as T)}
        >
          {props.options.map((option) => (
            <DropdownMenuRadioItem key={option.value} value={option.value} className="cursor-pointer">
              {option.label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AdminAppearanceControls(props: AdminAppearanceControlsProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2 sm:gap-3', props.className)}>
      <AppearanceDropdown
        ariaLabel="Color mode"
        value={props.mode}
        options={ADMIN_COLOR_MODE_OPTIONS}
        onValueChange={props.onModeChange}
        renderIcon={() => renderModeIcon(props.mode)}
        triggerClassName="min-w-[128px]"
      />
      <AppearanceDropdown
        ariaLabel="Color theme"
        value={props.theme}
        options={ADMIN_COLOR_THEME_OPTIONS}
        onValueChange={props.onThemeChange}
        renderIcon={() => <Palette className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
        triggerClassName="min-w-[132px]"
      />
    </div>
  );
}
