'use client';

import Link from 'next/link';
import { ArrowLeft, ArrowRight, BadgeCheck, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactElement } from 'react';
import type { GuidedDiagnosticOutcome } from '@techmd/diagnostic-core/guided-diagnostic-types';
import { Button } from '@/components/ui/button';
import { buildApiUrl } from '@/lib/config/build-api-url';
import type { PublicCatalogServiceRow, PublicCatalogServicesView } from '@/lib/data/public-catalog-services';
import { buildMarketingBookSessionPath } from '@/lib/marketing/quiz-session-marketing-ref';
import { resolveRecommendedServiceKey } from '@/lib/marketing/resolve-recommended-service-key';
import { scheduleScrollPageToTop } from '@/lib/marketing/scroll-page-to-top';
import { cn } from '@/lib/utils';

const CATALOG_SERVICES_API_URL = buildApiUrl('/api/catalog/services');

type OutcomeStep = 'summary' | 'pricing';

export type DiagnosticOutcomePanelProps = {
  readonly outcome: GuidedDiagnosticOutcome;
  readonly initialPrompt: string;
  readonly sessionReadOnly: boolean;
  readonly marketingBookSessionRef: string | null;
  readonly onReviewDiagnostic: () => void;
};

function ServicePricingCard(props: {
  readonly service: PublicCatalogServiceRow;
  readonly isRecommended: boolean;
  readonly isSelected: boolean;
  readonly onSelect: () => void;
}): ReactElement {
  const { service, isRecommended, isSelected, onSelect } = props;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={onSelect}
      className={cn(
        'flex w-full flex-col rounded-2xl border p-4 text-left transition-[border-color,box-shadow,background-color] duration-200 motion-safe:hover:border-primary/35',
        isSelected
          ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
          : 'border-border bg-card shadow-xs hover:bg-muted/30',
        isRecommended && !isSelected ? 'border-primary/25' : null,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-base font-semibold text-foreground">{service.title}</h4>
            {isRecommended ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                <Sparkles className="size-3.5" aria-hidden />
                Recommended
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{service.durationLabel}</p>
          {service.description.trim().length > 0 ? (
            <div className="mt-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">What&apos;s included</p>
              <p
                className={cn(
                  'mt-1 text-sm leading-relaxed text-foreground/85',
                  isSelected ? null : 'line-clamp-3',
                )}
              >
                {service.description}
              </p>
            </div>
          ) : null}
        </div>
        <span
          className={cn(
            'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
            isSelected ? 'border-primary bg-primary' : 'border-muted-foreground/40',
          )}
          aria-hidden
        >
          {isSelected ? <span className="size-2 rounded-full bg-primary-foreground" /> : null}
        </span>
      </div>
      <div className="mt-4 flex items-baseline justify-between gap-2 border-t border-border/80 pt-4">
        <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">{service.amountLabel}</p>
        {service.kind === 'package' && service.sessionsIncluded !== null ? (
          <p className="text-xs text-muted-foreground">{service.sessionsIncluded} sessions included</p>
        ) : (
          <p className="text-xs text-muted-foreground">per session</p>
        )}
      </div>
    </button>
  );
}

export function DiagnosticOutcomePanel(props: DiagnosticOutcomePanelProps): ReactElement {
  const { outcome, initialPrompt, sessionReadOnly, marketingBookSessionRef, onReviewDiagnostic } = props;
  const [step, setStep] = useState<OutcomeStep>('summary');
  const [catalog, setCatalog] = useState<PublicCatalogServicesView | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [selectedServiceKey, setSelectedServiceKey] = useState<string>(outcome.recommendedServiceKey);
  const enabledKeys = useMemo((): readonly string[] => {
    if (catalog === null) {
      return [];
    }
    return [...catalog.sessions, ...catalog.packages].map((row) => row.serviceKey);
  }, [catalog]);
  const usesFallbackCheckout = catalog !== null && !catalog.hasEnabledServices && catalog.fallbackCheckout !== null;
  const resolvedRecommendedKey = useMemo(
    () =>
      resolveRecommendedServiceKey({
        candidateKey: outcome.recommendedServiceKey,
        mappedSituation: outcome.mappedSituation,
        initialPrompt,
        advisorSummary: outcome.advisorSummary,
        enabledServiceKeys: enabledKeys,
      }),
    [enabledKeys, initialPrompt, outcome],
  );
  const recommendedService = useMemo((): PublicCatalogServiceRow | null => {
    if (catalog === null) {
      return null;
    }
    return (
      [...catalog.sessions, ...catalog.packages].find((row) => row.serviceKey === resolvedRecommendedKey) ?? null
    );
  }, [catalog, resolvedRecommendedKey]);
  useEffect(() => {
    let cancelled = false;
    void fetch(CATALOG_SERVICES_API_URL, { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json()) as PublicCatalogServicesView & { error?: string };
        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to load services');
        }
        return payload;
      })
      .then((payload) => {
        if (cancelled) {
          return;
        }
        setCatalog(payload);
        setCatalogStatus('ready');
        const keys = [...payload.sessions, ...payload.packages].map((row) => row.serviceKey);
        const recommended = resolveRecommendedServiceKey({
          candidateKey: outcome.recommendedServiceKey,
          mappedSituation: outcome.mappedSituation,
          initialPrompt,
          advisorSummary: outcome.advisorSummary,
          enabledServiceKeys: keys,
        });
        setSelectedServiceKey(
          recommended.length > 0 ? recommended : !payload.hasEnabledServices ? 'fallback' : '',
        );
      })
      .catch(() => {
        if (!cancelled) {
          setCatalogStatus('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, [initialPrompt, outcome]);
  const bookHref =
    marketingBookSessionRef !== null && marketingBookSessionRef.trim().length > 0
      ? buildMarketingBookSessionPath(
          marketingBookSessionRef,
          selectedServiceKey === 'fallback' || selectedServiceKey.trim().length === 0
            ? null
            : selectedServiceKey,
        )
      : null;
  const selectedService =
    catalog !== null
      ? [...catalog.sessions, ...catalog.packages].find((row) => row.serviceKey === selectedServiceKey) ?? null
      : null;
  const fallbackCheckout = catalog?.fallbackCheckout ?? null;
  const executeShowPricingStep = useCallback((): void => {
    setStep('pricing');
    scheduleScrollPageToTop();
  }, []);
  const executeShowSummaryStep = useCallback((): void => {
    setStep('summary');
    scheduleScrollPageToTop();
  }, []);
  if (step === 'summary') {
    const { advisorSummary, briefAssessment, sessionTitle, goodFitBullets } = outcome;
    return (
      <div>
        <p className="mt-2 text-pretty text-muted-foreground">
          {!sessionReadOnly ? (
            <>
              Here is what we recommend from your answers. Review the summary below, then continue to choose your session
              and see pricing.
            </>
          ) : null}
        </p>
        <div className="mt-6 space-y-5 md:mt-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-primary">Intake complete</p>
            <h2 className="mt-1.5 text-balance text-xl font-semibold tracking-tight text-foreground md:mt-2 md:text-2xl lg:text-3xl">
              {sessionTitle}
            </h2>
            <p className="mt-3 text-pretty text-base text-muted-foreground md:text-lg">{briefAssessment}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs md:rounded-2xl md:p-6">
            <h3 className="text-lg font-semibold text-foreground">Your advisor summary</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Pulled from your diagnostic — the same summary your advisor sees before the session.
            </p>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-foreground">{advisorSummary}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4 shadow-xs md:rounded-2xl md:p-6">
            <h3 className="text-lg font-semibold text-foreground">What&apos;s included</h3>
            {recommendedService !== null ? (
              <p className="mt-1 text-sm font-medium text-foreground">{recommendedService.title}</p>
            ) : null}
            {catalogStatus === 'loading' ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading service details…
              </div>
            ) : recommendedService !== null && recommendedService.description.trim().length > 0 ? (
              <p className="mt-3 text-sm leading-relaxed text-foreground md:mt-4">
                {recommendedService.description.trim()}
              </p>
            ) : catalogStatus === 'error' ? (
              <p className="mt-3 text-sm text-muted-foreground">
                Could not load service details. Continue to the next step to view all options.
              </p>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">
                Full session details appear on the next step when you choose your service.
              </p>
            )}
            {recommendedService !== null && recommendedService.durationLabel.trim().length > 0 ? (
              <p className="mt-3 text-sm text-muted-foreground">{recommendedService.durationLabel}</p>
            ) : null}
          </div>
          <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4 md:rounded-2xl md:p-6">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Good fit if</h3>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              {goodFitBullets.map((line, index) => (
                <li key={`${index}-${line.slice(0, 24)}`}>{line}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" onClick={onReviewDiagnostic}>
              Review diagnostic
            </Button>
            {!sessionReadOnly ? (
              <Button type="button" size="lg" className="gap-2" onClick={executeShowPricingStep}>
                Choose your session
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-foreground hover:bg-muted"
          onClick={executeShowSummaryStep}
          aria-label="Back to recommendation summary"
        >
          <ArrowLeft className="size-4" aria-hidden />
        </button>
        <span>
          Step 2 of 2 — <span className="font-medium text-foreground">Choose your session</span>
        </span>
      </div>
      <p className="mt-4 text-pretty text-muted-foreground">
        Select the engagement that fits your situation. We highlighted the option that best matches your diagnostic
        answers; you can choose any available service.
      </p>
      {catalogStatus === 'loading' ? (
        <div className="mt-10 flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-5 animate-spin" aria-hidden />
          Loading sessions and pricing…
        </div>
      ) : null}
      {catalogStatus === 'error' ? (
        <p className="mt-10 text-sm text-destructive" role="alert">
          Could not load pricing. Please refresh the page or contact support.
        </p>
      ) : null}
      {catalogStatus === 'ready' && catalog !== null ? (
        <div className="mt-8 space-y-8">
          {catalog.sessions.length > 0 ? (
            <section aria-labelledby="catalog-sessions-heading">
              <h3 id="catalog-sessions-heading" className="text-lg font-semibold text-foreground">
                Consultation sessions
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">Focused one-time advisory calls.</p>
              <div
                className="mt-4 grid gap-4 lg:grid-cols-2"
                role="radiogroup"
                aria-label="Consultation sessions"
              >
                {catalog.sessions.map((service) => (
                  <ServicePricingCard
                    key={service.serviceKey}
                    service={service}
                    isRecommended={service.serviceKey === resolvedRecommendedKey}
                    isSelected={selectedServiceKey === service.serviceKey}
                    onSelect={() => setSelectedServiceKey(service.serviceKey)}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {catalog.packages.length > 0 ? (
            <section aria-labelledby="catalog-packages-heading">
              <h3 id="catalog-packages-heading" className="text-lg font-semibold text-foreground">
                Packages
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">Multiple checkpoints at a bundle rate.</p>
              <div className="mt-4 grid gap-4 lg:grid-cols-2" role="radiogroup" aria-label="Advisory packages">
                {catalog.packages.map((service) => (
                  <ServicePricingCard
                    key={service.serviceKey}
                    service={service}
                    isRecommended={service.serviceKey === resolvedRecommendedKey}
                    isSelected={selectedServiceKey === service.serviceKey}
                    onSelect={() => setSelectedServiceKey(service.serviceKey)}
                  />
                ))}
              </div>
            </section>
          ) : null}
          {usesFallbackCheckout && fallbackCheckout !== null ? (
            <section aria-labelledby="catalog-fallback-heading">
              <h3 id="catalog-fallback-heading" className="text-lg font-semibold text-foreground">
                Standard consultation
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Catalog pricing is not configured. You can book at the standard checkout rate below.
              </p>
              <button
                type="button"
                role="radio"
                aria-checked={selectedServiceKey === 'fallback'}
                onClick={() => setSelectedServiceKey('fallback')}
                className={cn(
                  'mt-4 flex w-full flex-col rounded-2xl border p-4 text-left transition-[border-color,box-shadow,background-color] duration-200',
                  selectedServiceKey === 'fallback'
                    ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
                    : 'border-border bg-card shadow-xs hover:bg-muted/30',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-base font-semibold text-foreground">{fallbackCheckout.title}</h4>
                    <p className="mt-1 text-sm text-muted-foreground">One advisory session at the standard rate.</p>
                  </div>
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                      selectedServiceKey === 'fallback' ? 'border-primary bg-primary' : 'border-muted-foreground/40',
                    )}
                    aria-hidden
                  >
                    {selectedServiceKey === 'fallback' ? (
                      <span className="size-2 rounded-full bg-primary-foreground" />
                    ) : null}
                  </span>
                </div>
                <div className="mt-4 flex items-baseline justify-between gap-2 border-t border-border/80 pt-4">
                  <p className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                    {fallbackCheckout.amountLabel}
                  </p>
                  <p className="text-xs text-muted-foreground">per session</p>
                </div>
              </button>
            </section>
          ) : null}
          <div className="rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3">
            <p className="flex items-start gap-2 text-sm text-foreground">
              <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                {selectedService !== null ? (
                  <>
                    You selected <span className="font-semibold">{selectedService.title}</span> (
                    {selectedService.amountLabel}
                    {selectedService.kind === 'package' ? ' package' : ''}
                    ).
                    {selectedService.description.trim().length > 0 ? (
                      <span className="mt-2 block text-muted-foreground">{selectedService.description}</span>
                    ) : null}
                  </>
                ) : selectedServiceKey === 'fallback' && fallbackCheckout !== null ? (
                  <>
                    You selected <span className="font-semibold">{fallbackCheckout.title}</span> (
                    {fallbackCheckout.amountLabel}).
                  </>
                ) : (
                  'Select a service to continue.'
                )}
              </span>
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="outline" onClick={executeShowSummaryStep}>
              Back to summary
            </Button>
            {sessionReadOnly ? (
              <p className="text-sm text-muted-foreground">This intake is already linked to a booking.</p>
            ) : bookHref !== null &&
              (selectedService !== null || selectedServiceKey === 'fallback') ? (
              <Button asChild size="lg" className="gap-2">
                <Link href={bookHref}>
                  Book {selectedService?.title ?? fallbackCheckout?.title ?? 'session'}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
