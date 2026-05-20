import Link from 'next/link';
import type { ReactElement } from 'react';
import { TechmdSiteLogo } from '@/components/marketing/techmd-site-logo';

const FOOTER_LINK_GROUPS: readonly {
  readonly title: string;
  readonly links: readonly { readonly href: string; readonly label: string }[];
}[] = [
  {
    title: 'Explore',
    links: [
      { href: '/#how-it-works', label: 'How it works' },
      { href: '/#services', label: 'Services' },
      { href: '/#about', label: 'About' },
      { href: '/#resources', label: 'Resources' },
    ],
  },
  {
    title: 'Get started',
    links: [
      { href: '/diagnostic', label: 'Guided diagnostic' },
      { href: '/book', label: 'Book a session' },
      { href: '/book/manage', label: 'Manage booking' },
      { href: '/login', label: 'Sign in' },
    ],
  },
] as const;

/**
 * Multi-column marketing footer inspired by premium agency one-page layouts.
 */
export function MarketingSiteFooter(): ReactElement {
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.2fr_repeat(2,minmax(0,1fr))] lg:gap-12">
          <div className="space-y-4">
            <Link
              href="/"
              className="inline-block text-foreground outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <TechmdSiteLogo />
            </Link>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              Independent technology guidance for growing teams in the Philippines — from diagnostic to a
              decision you can ship.
            </p>
          </div>
          {FOOTER_LINK_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">{group.title}</p>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-2 border-t border-border/80 pt-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} TechMD. Philippines · Asia/Manila.</p>
          <p className="text-muted-foreground/90">
            Pain-first guidance · Guided steps · Vendor-neutral recommendations
          </p>
        </div>
      </div>
    </footer>
  );
}
