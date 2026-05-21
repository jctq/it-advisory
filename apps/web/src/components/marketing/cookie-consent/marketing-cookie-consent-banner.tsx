'use client';

import { useMarketingCookieConsent } from '@/components/marketing/cookie-consent/marketing-cookie-consent-context';
import { Button } from '@/components/ui/button';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { LEGAL_DOCUMENT_PATHS } from '@/lib/marketing/legal-document-id';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

const BANNER_ENTER_TRANSITION = { type: 'spring', damping: 30, stiffness: 340, mass: 0.85 } as const;

/**
 * Bottom cookie notice shown until the visitor saves a preference.
 */
export function MarketingCookieConsentBanner(): ReactElement {
  const prefersReducedMotion = usePrefersReducedMotion();
  const { isBannerVisible, acceptAll, acceptEssentialOnly, openPreferences, dismissBanner } = useMarketingCookieConsent();
  return (
    <AnimatePresence>
      {isBannerVisible ? (
        <motion.div
          key="cookie-consent-banner"
          role="dialog"
          aria-labelledby="cookie-banner-title"
          aria-describedby="cookie-banner-description"
          initial={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: '100%' }}
          animate={{ opacity: 1, y: 0 }}
          exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: '100%' }}
          transition={prefersReducedMotion ? { duration: 0.15 } : BANNER_ENTER_TRANSITION}
          className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-card/95 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-sm dark:shadow-[0_-8px_30px_rgba(0,0,0,0.35)]"
        >
          <div className="relative mx-auto max-w-6xl px-4 py-5 sm:px-6 lg:py-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              <div className="min-w-0 flex-1 space-y-2 pr-8 lg:pr-0">
                <h2 id="cookie-banner-title" className="text-base font-semibold tracking-tight text-foreground">
                  Cookies on TechMD
                </h2>
                <p id="cookie-banner-description" className="text-sm leading-relaxed text-muted-foreground">
                  Our site needs some cookies to work (sessions, diagnostic progress, and security). With your permission, we
                  also use Google Analytics to understand usage and improve the experience. You can change this anytime via{' '}
                  <button
                    type="button"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                    onClick={openPreferences}
                  >
                    cookie preferences
                  </button>
                  .
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground/90">
                  See our{' '}
                  <Link href={LEGAL_DOCUMENT_PATHS['privacy-policy']} className="font-medium text-primary underline-offset-2 hover:underline">
                    Privacy Policy
                  </Link>{' '}
                  for how we process information in the Philippines. We do not sell your personal data.
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:items-center lg:flex-col lg:items-stretch lg:pt-1">
                <Button type="button" size="lg" className="w-full min-w-[10.5rem] lg:w-44" onClick={acceptAll}>
                  Accept all
                </Button>
                <Button type="button" variant="outline" size="lg" className="w-full min-w-[10.5rem] lg:w-44" onClick={openPreferences}>
                  Cookie settings
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  className="w-full text-muted-foreground lg:w-44"
                  onClick={acceptEssentialOnly}
                >
                  Required only
                </Button>
              </div>
            </div>
          </div>
          <button
            type="button"
            className="absolute right-3 top-3 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:right-6 lg:top-5"
            aria-label="Use required cookies only and close"
            onClick={dismissBanner}
          >
            <X className="size-4" aria-hidden />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
