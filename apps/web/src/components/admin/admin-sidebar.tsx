'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarClock,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleUser,
  ClipboardList,
  FileStack,
  LifeBuoy,
  Settings,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type AdminSidebarProps = {
  readonly collapsed: boolean;
  readonly mobileOpen: boolean;
  readonly onCloseMobile: () => void;
  readonly onToggleCollapsed: () => void;
};

type AdminSidebarItem = {
  readonly href: string;
  readonly label: string;
  readonly icon: typeof FileStack;
};

const ADMIN_SIDEBAR_ITEMS: readonly AdminSidebarItem[] = [
  {
    href: '/admin/diagnostic-templates',
    label: 'Templates',
    icon: FileStack,
  },
  {
    href: '/admin/quiz-sessions',
    label: 'Quiz sessions',
    icon: ClipboardList,
  },
  {
    href: '/admin/leads',
    label: 'Leads',
    icon: Users,
  },
  {
    href: '/admin/users',
    label: 'Marketing users',
    icon: CircleUser,
  },
  {
    href: '/admin/schedule',
    label: 'Schedule',
    icon: CalendarClock,
  },
  {
    href: '/admin/bookings',
    label: 'Bookings',
    icon: CalendarDays,
  },
  {
    href: '/admin/advisor',
    label: 'Advisor',
    icon: LifeBuoy,
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    icon: Settings,
  },
] as const;

function isItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AdminSidebar(props: AdminSidebarProps) {
  const pathname = usePathname();
  return (
    <>
      <div
        aria-hidden={!props.mobileOpen}
        className={cn(
          'fixed inset-0 z-40 bg-background/80 backdrop-blur-sm transition-opacity md:hidden',
          props.mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={props.onCloseMobile}
      />
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex border-r border-sidebar-border/90 bg-sidebar/95 text-sidebar-foreground backdrop-blur md:sticky md:top-0 md:z-35 md:h-dvh',
          'transition-[width,transform] duration-200 ease-out',
          props.collapsed ? 'w-20' : 'w-72',
          props.mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        )}
      >
        <div className="flex w-full flex-col">
          <div
            className={cn(
              'flex items-center border-b border-sidebar-border/80 px-4 py-4',
              props.collapsed ? 'justify-center' : 'justify-between',
            )}
          >
            {props.collapsed ? (
              <span className="flex size-10 items-center justify-center rounded-2xl bg-sidebar-primary/15 text-sidebar-primary shadow-sm">
                IA
              </span>
            ) : (
              <div className="min-w-0">
                <p className="text-sm font-semibold text-sidebar-foreground">IT Advisory</p>
                <p className="text-xs text-sidebar-foreground/70">Admin console</p>
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={props.onToggleCollapsed}
              className="hidden md:inline-flex"
              aria-label={props.collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {props.collapsed ? <ChevronRight className="size-4" aria-hidden /> : <ChevronLeft className="size-4" aria-hidden />}
            </Button>
          </div>
          <div className="px-4 pt-4">
            {!props.collapsed ? (
              <div className="rounded-2xl border border-sidebar-border/80 bg-sidebar-accent/70 px-3 py-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/60">Workspace</p>
                <p className="mt-1 text-sm font-semibold text-sidebar-foreground">Customer operations</p>
                <p className="mt-1 text-xs text-sidebar-foreground/68">Templates, quiz sessions, leads, marketing users, bookings, advisor, and settings.</p>
              </div>
            ) : null}
          </div>
          <nav className="flex-1 space-y-1 px-3 py-4">
            {ADMIN_SIDEBAR_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={props.onCloseMobile}
                  className={cn(
                    'flex min-h-11 items-center rounded-2xl px-3 py-2 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                    props.collapsed ? 'justify-center' : 'gap-3',
                    active
                      ? 'bg-sidebar-accent text-sidebar-accent-foreground shadow-sm ring-1 ring-sidebar-border/80'
                      : 'text-sidebar-foreground/72 hover:bg-sidebar-accent/75 hover:text-sidebar-accent-foreground',
                  )}
                  aria-current={active ? 'page' : undefined}
                  title={props.collapsed ? item.label : undefined}
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {!props.collapsed ? <span>{item.label}</span> : null}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
    </>
  );
}
