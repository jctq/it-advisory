import Link from 'next/link';
import type { ReactElement } from 'react';
import { TechmdSiteLogo } from '@/components/marketing/techmd-site-logo';
import { LEGAL_DOCUMENT_PATHS } from '@/lib/marketing/legal-document-id';
import { readManageBookingEnabled } from '@/lib/marketing/manage-booking-gate';

type FooterLink = { readonly href: string; readonly label: string };

const EXPLORE_FOOTER_LINKS: readonly FooterLink[] = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/#services', label: 'Services' },
  { href: '/#about', label: 'About' },
  { href: '/#resources', label: 'Resources' },
  { href: '/blog', label: 'Blog' },
] as const;

const MANAGE_BOOKING_FOOTER_LINK: FooterLink = { href: '/book/manage', label: 'Manage booking' };

function buildGetStartedFooterLinks(manageBookingEnabled: boolean): readonly FooterLink[] {
  const links: FooterLink[] = [
    { href: '/diagnostic', label: 'Guided diagnostic' },
    { href: '/book', label: 'Book a session' },
  ];
  if (manageBookingEnabled) {
    links.push(MANAGE_BOOKING_FOOTER_LINK);
  }
  links.push({ href: '/login', label: 'Sign in' });
  return links;
}

/**
 * Multi-column marketing footer inspired by premium agency one-page layouts.
 */
export async function MarketingSiteFooter(): Promise<ReactElement> {
  const manageBookingEnabled = await readManageBookingEnabled();
  const footerLinkGroups: readonly { readonly title: string; readonly links: readonly FooterLink[] }[] = [
    { title: 'Explore', links: EXPLORE_FOOTER_LINKS },
    { title: 'Get started', links: buildGetStartedFooterLinks(manageBookingEnabled) },
  ];
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
          {footerLinkGroups.map((group) => (
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
        <div className="mt-12 flex flex-col gap-3 border-t border-border/80 pt-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} TechMD. Philippines · Asia/Manila.</p>
          <div className="flex flex-col gap-2 sm:items-end">
            <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1">
              <Link
                href={LEGAL_DOCUMENT_PATHS['privacy-policy']}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Privacy Policy
              </Link>
              <Link
                href={LEGAL_DOCUMENT_PATHS['terms-of-use']}
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                Terms of Use
              </Link>
            </nav>
            <p className="text-muted-foreground/90">
              Pain-first guidance · Guided steps · Vendor-neutral recommendations
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
