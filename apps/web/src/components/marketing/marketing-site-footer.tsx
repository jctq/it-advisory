import Link from 'next/link';
import type { ReactElement } from 'react';
import { MarketingCookiePreferencesLink } from '@/components/marketing/cookie-consent/marketing-cookie-preferences-link';
import { TechmdSiteLogo } from '@/components/marketing/techmd-site-logo';
import { listPublishedMarketingTestimonials } from '@/lib/data/testimonials';
import { LEGAL_DOCUMENT_PATHS } from '@/lib/marketing/legal-document-id';
import {
  buildMarketingExploreNavLinks,
  resolveMarketingCaseStudiesNavEnabled,
} from '@/lib/marketing/marketing-explore-nav-links';
import { readReviewsModuleEnabled } from '@/lib/marketing/reviews-module-gate';

type FooterLink = { readonly href: string; readonly label: string };

const START_HERE_FOOTER_LINKS: readonly FooterLink[] = [
  { href: '/diagnostic', label: 'Take the Assessment' },
  { href: '/book', label: 'Book a Consultation' },
  { href: '/login', label: 'Sign In' },
] as const;

/**
 * Multi-column marketing footer inspired by premium agency one-page layouts.
 */
export async function MarketingSiteFooter(): Promise<ReactElement> {
  const [reviewsModuleEnabled, testimonials] = await Promise.all([
    readReviewsModuleEnabled(),
    listPublishedMarketingTestimonials(),
  ]);
  const caseStudiesNavEnabled = resolveMarketingCaseStudiesNavEnabled({
    reviewsModuleEnabled,
    publishedTestimonialCount: testimonials.length,
  });
  const footerLinkGroups: readonly { readonly title: string; readonly links: readonly FooterLink[] }[] = [
    { title: 'Explore', links: buildMarketingExploreNavLinks(caseStudiesNavEnabled) },
    { title: 'Start Here', links: START_HERE_FOOTER_LINKS },
  ];
  return (
    <footer className="border-t border-border bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 py-14 md:py-16">
        <div className="flex flex-col gap-10 md:flex-row md:items-start md:justify-between lg:gap-16">
          <div className="space-y-4 md:max-w-xs lg:max-w-sm">
            <Link
              href="/"
              className="inline-block text-foreground outline-none ring-offset-background transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <TechmdSiteLogo />
            </Link>
            <p className="text-sm leading-relaxed text-muted-foreground">
              TeqMD helps organizations diagnose challenges, evaluate options, and make confident technology
              decisions before investing time and money.
            </p>
          </div>
          <nav
            aria-label="Footer"
            className="grid grid-cols-2 gap-x-10 gap-y-8 sm:gap-x-14 md:shrink-0 md:gap-x-12 lg:gap-x-20"
          >
            {footerLinkGroups.map((group) => (
              <div key={group.title}>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground">{group.title}</p>
                <ul className="mt-4 space-y-1">
                  {group.links.map((link) => (
                    <li key={link.href}>
                      <Link
                        href={link.href}
                        className="inline-block rounded-sm py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-border/80 pt-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <p>© {new Date().getFullYear()} TeqMD. All Rights Reserved.</p>
            <p>Independent Technology Advisory • Philippines</p>
          </div>
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
              <MarketingCookiePreferencesLink className="text-muted-foreground transition-colors hover:text-foreground" />
            </nav>
            <p className="text-muted-foreground/90">
              Independent Advice · Practical Recommendations · Better Technology Decisions
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
