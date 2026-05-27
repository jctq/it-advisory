'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  BookOpen,
  Briefcase,
  CalendarDays,
  CircleHelp,
  Info,
  LogIn,
  Menu,
  Rocket,
  UserPlus,
  type LucideIcon,
} from 'lucide-react';
import { MarketingHeaderAccountMenuPanel } from '@/components/marketing/marketing-header-account-menu-panel';
import type { ReactElement } from 'react';
import { useCallback } from 'react';
import { useMarketingChromeStore } from '@/store/marketing/marketing-chrome-store';
import { MarketingHeaderAccountMenu } from '@/components/marketing/marketing-header-account-menu';
import { MarketingHeaderAppearanceMenu } from '@/components/marketing/marketing-header-appearance-menu';
import { useMarketingAppearance } from '@/components/marketing/marketing-appearance-provider';
import { TechmdSiteLogo } from '@/components/marketing/techmd-site-logo';
import { useMarketingNewQuizNavigation } from '@/components/marketing/marketing-new-quiz-session-client';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import type { AuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { cn } from '@/lib/utils';

const BASE_NAV_LINKS: readonly { readonly href: string; readonly label: string }[] = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#services', label: 'Services' },
  { href: '/#about', label: 'About' },
  { href: '/#resources', label: 'Resources' },
] as const;

const MANAGE_BOOKING_NAV_LINK = { href: '/book/manage', label: 'Manage booking' } as const;

const MOBILE_NAV_LINK_ICONS: Record<string, LucideIcon> = {
  '/#how-it-works': CircleHelp,
  '/#services': Briefcase,
  '/#about': Info,
  '/#resources': BookOpen,
  '/book/manage': CalendarDays,
};

const MOBILE_SHEET_NAV_ITEM_CLASS =
  'flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent';

export type SiteHeaderClientProps = {
  readonly marketingUser: AuthenticatedMarketingUser | null;
  readonly manageBookingEnabled: boolean;
  readonly className?: string;
};

/**
 * Interactive marketing header (navigation, optional account actions).
 */
export function SiteHeaderClient(props: SiteHeaderClientProps): ReactElement {
  const navLinks = props.manageBookingEnabled
    ? [...BASE_NAV_LINKS, MANAGE_BOOKING_NAV_LINK]
    : BASE_NAV_LINKS;
  const router = useRouter();
  const pathname = usePathname();
  const { colorMode, colorTheme, executeChangeColorMode, executeChangeColorTheme } = useMarketingAppearance();
  const executeSignOut = useCallback(async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.replace('/');
    await router.refresh();
  }, [router]);
  const user = props.marketingUser;
  const isAuthenticated = user !== null;
  const { navigateToNewQuiz, isNavigating } = useMarketingNewQuizNavigation(isAuthenticated);
  const executeHomeLogoClick = useCallback((): void => {
    if (pathname !== '/') {
      return;
    }
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [pathname]);
  const isMobileMenuOpen = useMarketingChromeStore((state) => state.isMobileMenuOpen);
  const setMobileMenuOpen = useMarketingChromeStore((state) => state.setMobileMenuOpen);
  const executeCloseMobileMenu = useMarketingChromeStore((state) => state.executeCloseMobileMenu);
  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-border/60 bg-background/90 shadow-sm backdrop-blur-lg supports-backdrop-filter:bg-background/70',
        props.className,
      )}
    >
      <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-3 px-4 py-2 sm:min-h-16 sm:gap-4 md:px-4 lg:px-0 lg:gap-6">
        <Link
          href="/"
          onClick={executeHomeLogoClick}
          className="shrink-0 text-foreground outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <TechmdSiteLogo />
        </Link>
        <nav
          className="hidden min-h-10 min-w-0 flex-1 items-center justify-center gap-x-5 text-sm xl:flex xl:gap-x-7 2xl:gap-x-8"
          aria-label="Primary"
        >
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="whitespace-nowrap font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
          <MarketingHeaderAppearanceMenu
            className="shrink-0"
            colorMode={colorMode}
            colorTheme={colorTheme}
            onModeChange={executeChangeColorMode}
            onThemeChange={executeChangeColorTheme}
          />
          {user === null ? (
            <div className="hidden items-center gap-2 xl:flex xl:gap-3">
              <Button variant="ghost" size="sm" className="h-10 px-3" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button variant="outline" size="sm" className="h-10 px-3" asChild>
                <Link href="/register">Register</Link>
              </Button>
            </div>
          ) : (
            <div className="hidden xl:block">
              <MarketingHeaderAccountMenu
                user={user}
                manageBookingEnabled={props.manageBookingEnabled}
                onSignOut={() => void executeSignOut()}
              />
            </div>
          )}
          {isAuthenticated ? (
            <Button
              type="button"
              className="hidden h-10 xl:inline-flex"
              disabled={isNavigating}
              onClick={() => void navigateToNewQuiz()}
            >
              {isNavigating ? 'Starting…' : 'Get Started'}
            </Button>
          ) : (
            <Button asChild className="hidden h-10 xl:inline-flex">
              <Link href="/diagnostic">Get Started</Link>
            </Button>
          )}
          <Sheet open={isMobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0 xl:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" aria-hidden />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="right"
              className="flex w-[min(100vw-2rem,19rem)] flex-col gap-0 p-0 sm:max-w-xs"
            >
              <SheetHeader className="border-b border-border px-4 py-4 text-left">
                <SheetTitle />
                <SheetDescription className="sr-only">Site navigation and account actions</SheetDescription>
              </SheetHeader>
              <nav className="flex flex-1 flex-col overflow-y-auto py-2" aria-label="Mobile">
                {navLinks.map((link) => {
                  const NavIcon = MOBILE_NAV_LINK_ICONS[link.href];
                  return (
                    <a
                      key={link.href}
                      href={link.href}
                      className={MOBILE_SHEET_NAV_ITEM_CLASS}
                      onClick={executeCloseMobileMenu}
                    >
                      {NavIcon !== undefined ? (
                        <NavIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      ) : null}
                      {link.label}
                    </a>
                  );
                })}
                <Separator className="my-2" />
                {user === null ? (
                  <>
                    <Link href="/login" className={MOBILE_SHEET_NAV_ITEM_CLASS} onClick={executeCloseMobileMenu}>
                      <LogIn className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      Sign in
                    </Link>
                    <Link href="/register" className={MOBILE_SHEET_NAV_ITEM_CLASS} onClick={executeCloseMobileMenu}>
                      <UserPlus className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      Register
                    </Link>
                  </>
                ) : (
                  <MarketingHeaderAccountMenuPanel
                    user={user}
                    manageBookingEnabled={props.manageBookingEnabled}
                    onSignOut={() => void executeSignOut()}
                    onNavigate={executeCloseMobileMenu}
                  />
                )}
                <Separator className="my-2" />
                <div className="px-2">
                  {isAuthenticated ? (
                    <Button
                      type="button"
                      className="h-10 w-full gap-2"
                      disabled={isNavigating}
                      onClick={() => {
                        executeCloseMobileMenu();
                        void navigateToNewQuiz();
                      }}
                    >
                      <Rocket className="size-4 shrink-0" aria-hidden />
                      {isNavigating ? 'Starting…' : 'Get Started'}
                    </Button>
                  ) : (
                    <Button asChild className="h-10 w-full gap-2" onClick={executeCloseMobileMenu}>
                      <Link href="/diagnostic">
                        <Rocket className="size-4 shrink-0" aria-hidden />
                        Get Started
                      </Link>
                    </Button>
                  )}
                </div>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
