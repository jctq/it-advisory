'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import type { ReactElement } from 'react';
import { useCallback } from 'react';
import { MarketingHeaderAccountMenu } from '@/components/marketing/marketing-header-account-menu';
import { MarketingHeaderAppearanceMenu } from '@/components/marketing/marketing-header-appearance-menu';
import { useMarketingAppearance } from '@/components/marketing/marketing-appearance-provider';
import { TechmdSiteLogo } from '@/components/marketing/techmd-site-logo';
import { useMarketingNewQuizNavigation } from '@/components/marketing/marketing-new-quiz-session-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { AuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { cn } from '@/lib/utils';

const BASE_NAV_LINKS: readonly { readonly href: string; readonly label: string }[] = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#services', label: 'Services' },
  { href: '/#about', label: 'About' },
  { href: '/#resources', label: 'Resources' },
] as const;

const MANAGE_BOOKING_NAV_LINK = { href: '/book/manage', label: 'Manage booking' } as const;

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
  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md supports-backdrop-filter:bg-background/75',
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-11 shrink-0 xl:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-5" aria-hidden />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-[min(100vw-2rem,19rem)] rounded-xl p-2"
            >
              {navLinks.map((link) => (
                <DropdownMenuItem key={link.href} asChild className="cursor-pointer rounded-lg px-3 py-2.5 font-medium">
                  <a href={link.href}>{link.label}</a>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator className="my-2" />
              {user === null ? (
                <>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-3 py-2 font-medium">
                    <Link href="/login">Sign in</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-3 py-2 font-medium">
                    <Link href="/register">Register</Link>
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuLabel className="break-all px-2 py-1 text-xs font-normal text-muted-foreground">
                    {user.email}
                  </DropdownMenuLabel>
                  <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-3 py-2 font-medium">
                    <Link href="/account/diagnostics">My diagnostics</Link>
                  </DropdownMenuItem>
                  {props.manageBookingEnabled ? (
                    <DropdownMenuItem asChild className="cursor-pointer rounded-lg px-3 py-2 font-medium">
                      <Link href="/book/manage">Manage booking</Link>
                    </DropdownMenuItem>
                  ) : null}
                  <DropdownMenuItem
                    className="cursor-pointer rounded-lg px-3 py-2 font-medium"
                    onClick={() => void executeSignOut()}
                  >
                    Sign out
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator className="my-2" />
              {isAuthenticated ? (
                <DropdownMenuItem
                  disabled={isNavigating}
                  className="cursor-pointer justify-center rounded-lg bg-primary px-3 py-2.5 font-medium text-primary-foreground focus:bg-primary focus:text-primary-foreground disabled:opacity-60"
                  onClick={() => void navigateToNewQuiz()}
                >
                  {isNavigating ? 'Starting…' : 'Get Started'}
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  asChild
                  className="cursor-pointer justify-center rounded-lg bg-primary px-3 py-2.5 font-medium text-primary-foreground focus:bg-primary focus:text-primary-foreground"
                >
                  <Link href="/diagnostic">Get Started</Link>
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
