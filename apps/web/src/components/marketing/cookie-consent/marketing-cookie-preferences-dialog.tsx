'use client';

import { CookieConsentSwitch } from '@/components/marketing/cookie-consent/cookie-consent-switch';
import { useMarketingCookieConsent } from '@/components/marketing/cookie-consent/marketing-cookie-consent-context';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LEGAL_DOCUMENT_PATHS } from '@/lib/marketing/legal-document-id';
import { ChevronDown } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';

/**
 * Detailed cookie preferences modal (category toggles).
 */
export function MarketingCookiePreferencesDialog(): ReactElement {
  const { isPreferencesOpen, draft, setDraftAnalytics, closePreferences, acceptEssentialOnly, saveCustomPreferences } =
    useMarketingCookieConsent();
  return (
    <Dialog open={isPreferencesOpen} onOpenChange={(open) => !open && closePreferences()}>
      <DialogContent className="max-h-[min(90vh,720px)] max-w-2xl overflow-y-auto sm:rounded-xl" showCloseButton>
        <DialogHeader className="pr-8 text-left">
          <DialogTitle className="text-xl font-semibold tracking-tight">Your cookie preferences</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed">
            Choose which optional cookies TeqMD may use. Required cookies stay on so the site can run sign-in, the
            guided diagnostic, and bookings. We do not sell your personal information.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <section className="rounded-lg border border-border bg-muted/20 p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Required cookies</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Needed for core features: session security, anonymous diagnostic progress, and account sign-in.
                </p>
              </div>
              <CookieConsentSwitch
                id="cookie-required"
                label="Required cookies"
                checked
                disabled
                onCheckedChange={() => undefined}
              />
            </div>
            <details className="group mt-3 text-sm text-muted-foreground">
              <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-foreground/90 marker:content-none [&::-webkit-details-marker]:hidden">
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                What these enable
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>HTTP-only visitor and auth session cookies</li>
                <li>Load balancing and fraud protection via our host</li>
                <li>Remembering your cookie choice on this device</li>
              </ul>
            </details>
          </section>
          <section className="rounded-lg border border-border p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-foreground">Analytics cookies</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  Help us understand how visitors use TeqMD (pages viewed, general traffic) through Google Analytics.
                  Data is aggregated and used to improve the experience.
                </p>
              </div>
              <CookieConsentSwitch
                id="cookie-analytics"
                label="Analytics cookies"
                checked={draft.analytics}
                onCheckedChange={setDraftAnalytics}
              />
            </div>
            <details className="group mt-3 text-sm text-muted-foreground">
              <summary className="flex cursor-pointer list-none items-center gap-1 font-medium text-foreground/90 marker:content-none [&::-webkit-details-marker]:hidden">
                <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
                What these enable
              </summary>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Google Analytics measurement (only if you turn this category on)</li>
                <li>Anonymous usage statistics such as page views and referral sources</li>
                <li>No advertising or cross-site ad personalization from TeqMD</li>
              </ul>
            </details>
          </section>
        </div>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Read our{' '}
          <Link href={LEGAL_DOCUMENT_PATHS['privacy-policy']} className="font-medium text-primary underline-offset-2 hover:underline">
            Privacy Policy
          </Link>{' '}
          for full details on cookies, retention, and your rights under Philippine data privacy rules.
        </p>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="secondary" size="lg" className="w-full sm:w-auto" onClick={acceptEssentialOnly}>
            Required only
          </Button>
          <Button type="button" size="lg" className="w-full sm:w-auto" onClick={saveCustomPreferences}>
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
