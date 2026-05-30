'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  CalendarClock,
  Bug,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleUser,
  ClipboardList,
  FileStack,
  FileText,
  Headphones,
  MessageSquareQuote,
  LayoutDashboard,
  LifeBuoy,
  Settings,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  brandAssetUrl,
  BRAND_LOGO_COMPACT_DARK,
  BRAND_LOGO_COMPACT_LIGHT,
  BRAND_MARK_DARK,
  BRAND_MARK_LIGHT,
} from '@/lib/brand/brand-assets';
import type { AdminOnboardingTourTarget } from '@/lib/admin/admin-onboarding';
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
  readonly tourTarget: AdminOnboardingTourTarget;
};

const ADMIN_SIDEBAR_ITEMS: readonly AdminSidebarItem[] = [
  {
    href: '/admin',
    label: 'Dashboard',
    icon: LayoutDashboard,
    tourTarget: 'nav-dashboard',
  },
  {
    href: '/admin/diagnostic-templates',
    label: 'Templates',
    icon: FileStack,
    tourTarget: 'nav-templates',
  },
  {
    href: '/admin/blog-posts',
    label: 'Blog',
    icon: FileText,
    tourTarget: 'nav-blog',
  },
  {
    href: '/admin/testimonials',
    label: 'Testimonials',
    icon: MessageSquareQuote,
    tourTarget: 'nav-testimonials',
  },
  {
    href: '/admin/sessions',
    label: 'Sessions',
    icon: ClipboardList,
    tourTarget: 'nav-sessions',
  },
  {
    href: '/admin/leads',
    label: 'Leads',
    icon: Users,
    tourTarget: 'nav-leads',
  },
  {
    href: '/admin/users',
    label: 'Marketing users',
    icon: CircleUser,
    tourTarget: 'nav-users',
  },
  {
    href: '/admin/schedule',
    label: 'Schedule',
    icon: CalendarClock,
    tourTarget: 'nav-schedule',
  },
  {
    href: '/admin/bookings',
    label: 'Bookings',
    icon: CalendarDays,
    tourTarget: 'nav-bookings',
  },
  {
    href: '/admin/support-reports',
    label: 'Support reports',
    icon: Headphones,
    tourTarget: 'nav-support-reports',
  },
  {
    href: '/admin/debug',
    label: 'Debug',
    icon: Bug,
    tourTarget: 'nav-debug',
  },
  {
    href: '/admin/advisor',
    label: 'Advisor',
    icon: LifeBuoy,
    tourTarget: 'nav-advisor',
  },
  {
    href: '/admin/settings',
    label: 'Settings',
    icon: Settings,
    tourTarget: 'nav-settings',
  },
] as const;

function isItemActive(pathname: string, href: string): boolean {
  if (href === '/admin') {
    return pathname === '/admin';
  }
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
        data-admin-tour="sidebar"
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
              <span className="flex size-10 items-center justify-center">
                <Image
                  src={brandAssetUrl(BRAND_MARK_LIGHT)}
                  alt="TEQMD"
                  width={326}
                  height={344}
                  className="size-9 object-contain dark:hidden"
                />
                <Image
                  src={brandAssetUrl(BRAND_MARK_DARK)}
                  alt="TEQMD"
                  width={326}
                  height={344}
                  className="hidden size-9 object-contain dark:block"
                />
              </span>
            ) : (
              <div className="min-w-0 overflow-visible">
                <Image
                  src={brandAssetUrl(BRAND_LOGO_COMPACT_LIGHT)}
                  alt="TEQMD"
                  width={1590}
                  height={374}
                  className="h-8 w-auto max-w-[min(100%,15rem)] object-contain object-left dark:hidden"
                />
                <Image
                  src={brandAssetUrl(BRAND_LOGO_COMPACT_DARK)}
                  alt="TEQMD"
                  width={1588}
                  height={374}
                  className="hidden h-8 w-auto max-w-[min(100%,15rem)] object-contain object-left dark:block"
                />
                <p className="mt-1 text-xs text-sidebar-foreground/70">Admin console</p>
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
              <div
                data-admin-tour="sidebar-workspace"
                className="rounded-2xl border border-sidebar-border/80 bg-sidebar-accent/70 px-3 py-3"
              >
                <p className="text-[11px] font-medium uppercase tracking-wide text-sidebar-foreground/60">Workspace</p>
                <p className="mt-1 text-sm font-semibold text-sidebar-foreground">Customer operations</p>
                <p className="mt-1 text-xs text-sidebar-foreground/68">Templates, sessions, leads, bookings, payments, support, debug, advisor, and settings.</p>
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
                  data-admin-tour={item.tourTarget}
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
