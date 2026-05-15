'use client';

import { LaptopMinimal, MoonStar, Palette, SunMedium } from 'lucide-react';
import {
  ADMIN_COLOR_MODE_OPTIONS,
  ADMIN_COLOR_THEME_OPTIONS,
  type AdminColorMode,
  type AdminColorTheme,
} from '@/lib/admin/admin-appearance';
import { NativeSelect } from '@/components/ui/native-select';
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
    return (
      <SunMedium
        className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    );
  }
  if (mode === 'dark') {
    return (
      <MoonStar
        className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
    );
  }
  return (
    <LaptopMinimal
      className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground"
      aria-hidden
    />
  );
}

export function AdminAppearanceControls(props: AdminAppearanceControlsProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-end gap-2 sm:gap-3', props.className)}>
      <label className="min-w-[140px] space-y-1">
        <div className="relative">
          {renderModeIcon(props.mode)}
          <NativeSelect
            aria-label="Color mode"
            value={props.mode}
            onChange={(event) => props.onModeChange(event.target.value as AdminColorMode)}
            className="min-h-11 min-w-[128px] pl-9 text-sm"
          >
            {ADMIN_COLOR_MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </label>
      <label className="min-w-[160px] space-y-1">
        <div className="relative">
          <Palette className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <NativeSelect
            aria-label="Color theme"
            value={props.theme}
            onChange={(event) => props.onThemeChange(event.target.value as AdminColorTheme)}
            className="min-h-11 min-w-[132px] pl-9 text-sm"
          >
            {ADMIN_COLOR_THEME_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </NativeSelect>
        </div>
      </label>
    </div>
  );
}
