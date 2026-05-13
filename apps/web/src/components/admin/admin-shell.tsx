'use client';

import { useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Menu } from 'lucide-react';
import {
  ADMIN_COLOR_MODE_STORAGE_KEY,
  ADMIN_COLOR_THEME_STORAGE_KEY,
  DEFAULT_ADMIN_COLOR_MODE,
  DEFAULT_ADMIN_COLOR_THEME,
  resolveAdminColorMode,
  resolveAdminColorTheme,
  type AdminColorMode,
  type AdminColorTheme,
} from '@/lib/admin/admin-appearance';
import { AdminAppearanceControls } from '@/components/admin/admin-appearance-controls';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AdminShellProps = {
  readonly children: ReactNode;
};

const ADMIN_SIDEBAR_STORAGE_KEY = 'it-advisory-admin-sidebar-collapsed';

type ApplyAdminAppearanceParams = {
  readonly colorTheme: AdminColorTheme;
  readonly isDark: boolean;
};

const ADMIN_DARK_BACKGROUND = '#0f172a';
const ADMIN_LIGHT_BACKGROUND = '#ffffff';

function subscribeToAdminStorage(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const executeHandleStorageChange = (event: StorageEvent): void => {
    if (
      event.key === null ||
      event.key === ADMIN_SIDEBAR_STORAGE_KEY ||
      event.key === ADMIN_COLOR_MODE_STORAGE_KEY ||
      event.key === ADMIN_COLOR_THEME_STORAGE_KEY
    ) {
      onStoreChange();
    }
  };
  window.addEventListener('storage', executeHandleStorageChange);
  return () => {
    window.removeEventListener('storage', executeHandleStorageChange);
  };
}

function resolveServerSidebarCollapsed(): boolean {
  return false;
}

function resolveClientSidebarCollapsed(): boolean {
  if (typeof window === 'undefined') {
    return resolveServerSidebarCollapsed();
  }
  return window.localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY) === 'true';
}

function resolveServerColorMode(): AdminColorMode {
  return DEFAULT_ADMIN_COLOR_MODE;
}

function resolveClientColorMode(): AdminColorMode {
  if (typeof window === 'undefined') {
    return resolveServerColorMode();
  }
  return resolveAdminColorMode(window.localStorage.getItem(ADMIN_COLOR_MODE_STORAGE_KEY));
}

function resolveServerColorTheme(): AdminColorTheme {
  return DEFAULT_ADMIN_COLOR_THEME;
}

function resolveClientColorTheme(): AdminColorTheme {
  if (typeof window === 'undefined') {
    return resolveServerColorTheme();
  }
  return resolveAdminColorTheme(window.localStorage.getItem(ADMIN_COLOR_THEME_STORAGE_KEY));
}

function subscribeToSystemColorScheme(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const executeHandleChange = (): void => {
    onStoreChange();
  };
  mediaQuery.addEventListener('change', executeHandleChange);
  return () => {
    mediaQuery.removeEventListener('change', executeHandleChange);
  };
}

function resolveServerSystemPrefersDark(): boolean {
  return false;
}

function resolveClientSystemPrefersDark(): boolean {
  if (typeof window === 'undefined') {
    return resolveServerSystemPrefersDark();
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

function resolveAdminTitle(pathname: string): string {
  if (pathname.startsWith('/admin/diagnostic-templates')) {
    return 'Diagnostic templates';
  }
  if (pathname.startsWith('/admin/quiz-sessions')) {
    return 'Quiz sessions';
  }
  if (pathname.startsWith('/admin/leads')) {
    return 'Leads';
  }
  if (pathname.startsWith('/admin/bookings')) {
    return 'Bookings';
  }
  if (pathname.startsWith('/admin/advisor')) {
    return 'Advisor';
  }
  if (pathname.startsWith('/admin/settings')) {
    return 'Settings';
  }
  return 'Admin';
}

function applyAdminAppearanceToDocument(params: ApplyAdminAppearanceParams): void {
  if (typeof document === 'undefined') {
    return;
  }
  const documentElement = document.documentElement;
  const backgroundColor = params.isDark ? ADMIN_DARK_BACKGROUND : ADMIN_LIGHT_BACKGROUND;
  documentElement.classList.toggle('dark', params.isDark);
  documentElement.style.colorScheme = params.isDark ? 'dark' : 'light';
  documentElement.style.backgroundColor = backgroundColor;
  documentElement.dataset.colorTheme = params.colorTheme;
}

function resetAdminAppearanceFromDocument(): void {
  if (typeof document === 'undefined') {
    return;
  }
  const documentElement = document.documentElement;
  documentElement.classList.remove('dark');
  documentElement.style.colorScheme = 'light';
  documentElement.style.backgroundColor = '';
  delete documentElement.dataset.colorTheme;
}

export function AdminShell(props: AdminShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [collapsedOverride, setCollapsedOverride] = useState<boolean | null>(null);
  const [colorModeOverride, setColorModeOverride] = useState<AdminColorMode | null>(null);
  const [colorThemeOverride, setColorThemeOverride] = useState<AdminColorTheme | null>(null);
  const storedCollapsed = useSyncExternalStore(
    subscribeToAdminStorage,
    resolveClientSidebarCollapsed,
    resolveServerSidebarCollapsed,
  );
  const storedColorMode = useSyncExternalStore(
    subscribeToAdminStorage,
    resolveClientColorMode,
    resolveServerColorMode,
  );
  const storedColorTheme = useSyncExternalStore(
    subscribeToAdminStorage,
    resolveClientColorTheme,
    resolveServerColorTheme,
  );
  const systemPrefersDark = useSyncExternalStore(
    subscribeToSystemColorScheme,
    resolveClientSystemPrefersDark,
    resolveServerSystemPrefersDark,
  );
  const collapsed = collapsedOverride ?? storedCollapsed;
  const colorMode = colorModeOverride ?? storedColorMode;
  const colorTheme = colorThemeOverride ?? storedColorTheme;
  const pageTitle = useMemo(() => resolveAdminTitle(pathname), [pathname]);
  const isDark = colorMode === 'dark' || (colorMode === 'system' && systemPrefersDark);
  useLayoutEffect(() => {
    applyAdminAppearanceToDocument({ colorTheme, isDark });
    return () => {
      resetAdminAppearanceFromDocument();
    };
  }, [colorTheme, isDark]);
  const executeToggleCollapsed = (): void => {
    const nextCollapsed = !collapsed;
    window.localStorage.setItem(ADMIN_SIDEBAR_STORAGE_KEY, nextCollapsed ? 'true' : 'false');
    setCollapsedOverride(nextCollapsed);
  };
  const executeChangeColorMode = (nextColorMode: AdminColorMode): void => {
    const nextIsDark = nextColorMode === 'dark' || (nextColorMode === 'system' && systemPrefersDark);
    window.localStorage.setItem(ADMIN_COLOR_MODE_STORAGE_KEY, nextColorMode);
    setColorModeOverride(nextColorMode);
    applyAdminAppearanceToDocument({ colorTheme, isDark: nextIsDark });
  };
  const executeChangeColorTheme = (nextColorTheme: AdminColorTheme): void => {
    window.localStorage.setItem(ADMIN_COLOR_THEME_STORAGE_KEY, nextColorTheme);
    setColorThemeOverride(nextColorTheme);
    applyAdminAppearanceToDocument({ colorTheme: nextColorTheme, isDark });
  };
  if (pathname === '/admin/login') {
    return props.children;
  }
  return (
    <div
      suppressHydrationWarning
      className={cn('min-h-dvh bg-muted/30 scheme-light dark:bg-background dark:scheme-dark')}
    >
      <div className="flex min-h-dvh">
        <AdminSidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          onToggleCollapsed={executeToggleCollapsed}
        />
        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-20 border-b border-border/80 bg-background/90 shadow-[0_1px_0_0_rgb(0_0_0/0.03)] backdrop-blur-md dark:shadow-[0_1px_0_0_rgb(255_255_255/0.04)]">
            <div className="mx-auto flex min-h-16 w-full flex-col gap-4 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="md:hidden"
                    onClick={() => setMobileOpen(true)}
                    aria-label="Open admin sidebar"
                  >
                    <Menu className="size-4" aria-hidden />
                  </Button>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="hidden size-10 items-center justify-center rounded-2xl bg-primary/10 text-primary md:flex">
                      <LayoutDashboard className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{pageTitle}</p>
                    </div>
                  </div>
                </div>
                <AdminAppearanceControls
                  mode={colorMode}
                  theme={colorTheme}
                  onModeChange={executeChangeColorMode}
                  onThemeChange={executeChangeColorTheme}
                />
              </div>
            </div>
          </div>
          <main className={cn('flex-1')}>
            <div className="mx-auto w-full px-4 py-6 sm:px-6 lg:px-8">
              <div className="rounded-[28px] border border-border/70 bg-background/80 p-4 shadow-sm backdrop-blur-sm sm:p-6 lg:p-8 dark:bg-card/45 dark:shadow-[0_18px_50px_rgb(2_6_23/0.18)]">
                {props.children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
