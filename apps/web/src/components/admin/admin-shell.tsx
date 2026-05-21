'use client';

import { useLayoutEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Menu } from 'lucide-react';
import {
  ADMIN_COLOR_MODE_STORAGE_KEY,
  ADMIN_COLOR_THEME_STORAGE_KEY,
  type AdminColorMode,
  type AdminColorTheme,
} from '@/lib/admin/admin-appearance';
import {
  applyDocumentAppearance,
  resolveClientAdminAppearanceMode,
  resolveClientAdminAppearanceTheme,
  resolveClientSystemPrefersDark,
  resolveServerAdminAppearanceMode,
  resolveServerAdminAppearanceTheme,
  resolveServerSystemPrefersDark,
  subscribeToAdminAppearanceStorage,
  subscribeToSystemColorScheme,
  syncMarketingDocumentAppearanceFromStorage,
} from '@/lib/admin/document-appearance';
import { AdminAppearanceControls } from '@/components/admin/admin-appearance-controls';
import { AdminSidebar } from '@/components/admin/admin-sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AdminShellProps = {
  readonly children: ReactNode;
};

const ADMIN_SIDEBAR_STORAGE_KEY = 'techmd-admin-sidebar-collapsed';

function subscribeToAdminStorage(onStoreChange: () => void): () => void {
  if (typeof window === 'undefined') {
    return () => undefined;
  }
  const unsubscribeAppearance = subscribeToAdminAppearanceStorage(onStoreChange);
  const executeHandleStorageChange = (event: StorageEvent): void => {
    if (event.key === null || event.key === ADMIN_SIDEBAR_STORAGE_KEY) {
      onStoreChange();
    }
  };
  window.addEventListener('storage', executeHandleStorageChange);
  return () => {
    unsubscribeAppearance();
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

function resolveAdminTitle(pathname: string): string {
  if (pathname === '/admin') {
    return 'Dashboard';
  }
  if (pathname.startsWith('/admin/diagnostic-templates')) {
    return 'Templates';
  }
  if (pathname.startsWith('/admin/sessions')) {
    return 'Sessions';
  }
  if (pathname.startsWith('/admin/leads')) {
    return 'Leads';
  }
  if (pathname.startsWith('/admin/users')) {
    return 'Marketing users';
  }
  if (pathname.startsWith('/admin/schedule')) {
    return 'Schedule';
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
    subscribeToAdminAppearanceStorage,
    resolveClientAdminAppearanceMode,
    resolveServerAdminAppearanceMode,
  );
  const storedColorTheme = useSyncExternalStore(
    subscribeToAdminAppearanceStorage,
    resolveClientAdminAppearanceTheme,
    resolveServerAdminAppearanceTheme,
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
    applyDocumentAppearance({ colorTheme, isDark });
    return () => {
      syncMarketingDocumentAppearanceFromStorage();
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
    applyDocumentAppearance({ colorTheme, isDark: nextIsDark });
  };
  const executeChangeColorTheme = (nextColorTheme: AdminColorTheme): void => {
    window.localStorage.setItem(ADMIN_COLOR_THEME_STORAGE_KEY, nextColorTheme);
    setColorThemeOverride(nextColorTheme);
    applyDocumentAppearance({ colorTheme: nextColorTheme, isDark });
  };
  if (pathname === '/admin/login') {
    return props.children;
  }
  return (
    <div
      suppressHydrationWarning
      className={cn('min-h-dvh bg-muted/30 scheme-light dark:bg-background dark:scheme-dark')}
    >
      <div className="flex min-h-dvh [--admin-sticky-top:4rem]">
        <AdminSidebar
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          onCloseMobile={() => setMobileOpen(false)}
          onToggleCollapsed={executeToggleCollapsed}
        />
        <div className="flex min-h-dvh min-w-0 flex-1 flex-col">
          <div className="sticky top-0 z-20 border-b border-border/80 bg-background/90 shadow-[0_1px_0_0_rgb(0_0_0/0.03)] backdrop-blur-md dark:shadow-[0_1px_0_0_rgb(255_255_255/0.04)]">
            <div className="mx-auto flex min-h-16 w-full flex-col gap-4 px-4 py-3 sm:px-6 lg:px-8">
              <div className="flex items-center justify-between gap-3">
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
                  variant="toolbar"
                  mode={colorMode}
                  theme={colorTheme}
                  onModeChange={executeChangeColorMode}
                  onThemeChange={executeChangeColorTheme}
                />
              </div>
            </div>
          </div>
          <main className={cn('flex-1')}>
            <div className="bg-background/80 px-3 py-4">
              {props.children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
