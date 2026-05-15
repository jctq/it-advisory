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
import type { AuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { cn } from '@/lib/utils';

const NAV_LINKS: readonly { readonly href: string; readonly label: string }[] = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#services', label: 'Services' },
  { href: '/#about', label: 'About' },
  { href: '/#resources', label: 'Resources' },
] as const;

export type SiteHeaderClientProps = {
  readonly marketingUser: AuthenticatedMarketingUser | null;
  readonly className?: string;
};

/**
 * Interactive marketing header (navigation, optional account actions).
 */
export function SiteHeaderClient(props: SiteHeaderClientProps): ReactElement {
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
        'sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/75',
        props.className,
      )}
    >
      <div className="mx-auto flex min-h-14 max-w-6xl items-center gap-3 px-4 py-2 sm:min-h-16 sm:gap-4 sm:px-0 lg:gap-6">
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
          {NAV_LINKS.map((link) => (
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
              <MarketingHeaderAccountMenu user={user} onSignOut={() => void executeSignOut()} />
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
              <Link href="/quiz">Get Started</Link>
            </Button>
          )}
          <details className="relative xl:hidden">
            <summary
              className="flex min-h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-md border border-border bg-background p-2 shadow-xs [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" aria-hidden />
            </summary>
            <div className="absolute right-0 z-50 mt-2 w-[min(100vw-2rem,19rem)] rounded-xl border border-border bg-popover p-2 shadow-lg">
              <ul className="flex flex-col gap-0.5">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="block rounded-lg px-3 py-2.5 text-sm font-medium text-popover-foreground hover:bg-accent"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
                {user === null ? (
                  <li className="border-t border-border pt-2">
                    <div className="flex flex-col gap-1">
                      <Link
                        href="/login"
                        className="rounded-lg px-3 py-2 text-sm font-medium text-popover-foreground hover:bg-accent"
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/register"
                        className="rounded-lg px-3 py-2 text-sm font-medium text-popover-foreground hover:bg-accent"
                      >
                        Register
                      </Link>
                    </div>
                  </li>
                ) : (
                  <li className="border-t border-border pt-2">
                    <div className="space-y-1 px-1">
                      <p className="break-all px-2 py-1 text-xs text-muted-foreground">{user.email}</p>
                      <Link
                        href="/account/diagnostics"
                        className="block rounded-lg px-3 py-2 text-sm font-medium text-popover-foreground hover:bg-accent"
                      >
                        My diagnostics
                      </Link>
                      <button
                        type="button"
                        className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-popover-foreground hover:bg-accent"
                        onClick={() => void executeSignOut()}
                      >
                        Sign out
                      </button>
                    </div>
                  </li>
                )}
                <li className="border-t border-border pt-2">
                  {isAuthenticated ? (
                    <button
                      type="button"
                      disabled={isNavigating}
                      className="w-full rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-medium text-primary-foreground disabled:opacity-60"
                      onClick={() => void navigateToNewQuiz()}
                    >
                      {isNavigating ? 'Starting…' : 'Get Started'}
                    </button>
                  ) : (
                    <Link
                      href="/quiz"
                      className="block rounded-lg bg-primary px-3 py-2.5 text-center text-sm font-medium text-primary-foreground"
                    >
                      Get Started
                    </Link>
                  )}
                </li>
              </ul>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
