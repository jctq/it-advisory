'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Menu } from 'lucide-react';
import { useCallback, type ReactElement } from 'react';
import { useMarketingNewQuizNavigation } from '@/components/marketing/marketing-new-quiz-session-client';
import { Button } from '@/components/ui/button';
import type { AuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { cn } from '@/lib/utils';

const NAV_LINKS: readonly { readonly href: string; readonly label: string }[] = [
  { href: '/#how-it-works', label: 'How It Works' },
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
  const executeSignOut = useCallback(async (): Promise<void> => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    router.replace('/');
    await router.refresh();
  }, [router]);
  const user = props.marketingUser;
  const isAuthenticated = user !== null;
  const { navigateToNewQuiz, isNavigating } = useMarketingNewQuizNavigation(isAuthenticated);
  const shortEmail =
    user !== null && user.email.length > 28 ? `${user.email.slice(0, 25)}…` : user?.email ?? '';
  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/75',
        props.className,
      )}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight text-foreground">
          IT Advisory
        </Link>
        <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {user === null ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Sign in</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/register">Register</Link>
              </Button>
            </div>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <span className="max-w-[10rem] truncate text-xs text-muted-foreground" title={user.email}>
                {shortEmail}
              </span>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/account/diagnostics">My diagnostics</Link>
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => void executeSignOut()}>
                Sign out
              </Button>
            </div>
          )}
          {isAuthenticated ? (
            <Button type="button" className="hidden sm:inline-flex" disabled={isNavigating} onClick={() => void navigateToNewQuiz()}>
              {isNavigating ? 'Starting…' : 'Get Started'}
            </Button>
          ) : (
            <Button asChild className="hidden sm:inline-flex">
              <Link href="/quiz">Get Started</Link>
            </Button>
          )}
          <details className="relative md:hidden">
            <summary
              className="flex cursor-pointer list-none items-center justify-center rounded-md border border-border bg-background p-2 shadow-xs [&::-webkit-details-marker]:hidden"
              aria-label="Open menu"
            >
              <Menu className="size-5" aria-hidden />
            </summary>
            <div className="absolute right-0 mt-2 w-52 rounded-lg border border-border bg-popover p-2 shadow-lg">
              <ul className="flex flex-col gap-1">
                {NAV_LINKS.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="block rounded-md px-3 py-2 text-sm font-medium text-popover-foreground hover:bg-accent"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
                <li className="border-t border-border pt-2">
                  {user === null ? (
                    <div className="flex flex-col gap-1">
                      <Link
                        href="/login"
                        className="block rounded-md px-3 py-2 text-sm font-medium text-popover-foreground hover:bg-accent"
                      >
                        Sign in
                      </Link>
                      <Link
                        href="/register"
                        className="block rounded-md px-3 py-2 text-sm font-medium text-popover-foreground hover:bg-accent"
                      >
                        Register
                      </Link>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1 px-1">
                      <p className="truncate px-2 py-1 text-xs text-muted-foreground" title={user.email}>
                        {shortEmail}
                      </p>
                      <Link
                        href="/account/diagnostics"
                        className="rounded-md px-3 py-2 text-sm font-medium text-popover-foreground hover:bg-accent"
                      >
                        My diagnostics
                      </Link>
                      <button
                        type="button"
                        className="rounded-md px-3 py-2 text-left text-sm font-medium text-popover-foreground hover:bg-accent"
                        onClick={() => void executeSignOut()}
                      >
                        Sign out
                      </button>
                    </div>
                  )}
                </li>
                <li className="pt-2">
                  {isAuthenticated ? (
                    <button
                      type="button"
                      disabled={isNavigating}
                      className="block w-full rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground disabled:opacity-60"
                      onClick={() => void navigateToNewQuiz()}
                    >
                      {isNavigating ? 'Starting…' : 'Get Started'}
                    </button>
                  ) : (
                    <Link
                      href="/quiz"
                      className="block rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
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
