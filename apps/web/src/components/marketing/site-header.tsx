import Link from 'next/link';
import { Menu } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const NAV_LINKS: readonly { readonly href: string; readonly label: string }[] = [
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/#services', label: 'Services' },
  { href: '/#about', label: 'About' },
  { href: '/#resources', label: 'Resources' },
] as const;

export function SiteHeader({ className }: { readonly className?: string }) {
  return (
    <header
      className={cn(
        'sticky top-0 z-50 border-b border-border/80 bg-background/95 backdrop-blur-md supports-[backdrop-filter]:bg-background/75',
        className,
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
          <Button asChild className="hidden sm:inline-flex">
            <Link href="/quiz">Get Started</Link>
          </Button>
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
                  <Link
                    href="/quiz"
                    className="block rounded-md bg-primary px-3 py-2 text-center text-sm font-medium text-primary-foreground"
                  >
                    Get Started
                  </Link>
                </li>
              </ul>
            </div>
          </details>
        </div>
      </div>
    </header>
  );
}
