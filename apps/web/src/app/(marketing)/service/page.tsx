import {
  PROJECT_RESCUE_BOOKING_FOOTNOTE,
  PROJECT_RESCUE_GOOD_FIT_BULLETS,
  PROJECT_RESCUE_PRICE_HEADLINE,
  PROJECT_RESCUE_SERVICE_TAGLINE,
  PROJECT_RESCUE_SERVICE_TITLE,
  PROJECT_RESCUE_SESSION_DURATION,
  PROJECT_RESCUE_WHATS_INCLUDED,
} from '@it-advisory/diagnostic-core/project-rescue-service-context';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getAuthenticatedMarketingUser } from '@/lib/server/marketing-auth';
import { ServiceAdvisorSummary } from './service-advisor-summary';
import { ServiceReviewDiagnosticButton } from './service-review-diagnostic-button';

export const metadata: Metadata = {
  title: `${PROJECT_RESCUE_SERVICE_TITLE} · IT Advisory`,
  description:
    'Structured consultation to stabilize timelines, clarify ownership, and reduce delivery risk.',
};

export default async function ServiceDetailPage() {
  const user = await getAuthenticatedMarketingUser();
  const isAuthenticated = user !== null;
  return (
    <main className="mx-auto max-w-6xl px-6 py-16 md:py-24">
      <div className="grid gap-12 lg:grid-cols-[1fr_320px] lg:items-start">
        <div>
          <p className="text-sm font-medium text-primary">Service detail</p>
          <ServiceAdvisorSummary
            fallbackTitle={PROJECT_RESCUE_SERVICE_TITLE}
            fallbackTagline={PROJECT_RESCUE_SERVICE_TAGLINE}
            whatsIncluded={PROJECT_RESCUE_WHATS_INCLUDED}
            fallbackGoodFitBullets={PROJECT_RESCUE_GOOD_FIT_BULLETS}
          />
        </div>
        <aside className="rounded-3xl border border-border bg-card p-8 shadow-xs lg:sticky lg:top-24">
          <p className="text-sm font-medium text-muted-foreground">Duration</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">{PROJECT_RESCUE_SESSION_DURATION}</p>
          <p className="mt-6 text-sm font-medium text-muted-foreground">Investment</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{PROJECT_RESCUE_PRICE_HEADLINE}</p>
          <p className="mt-2 text-sm text-muted-foreground">{PROJECT_RESCUE_BOOKING_FOOTNOTE}</p>
          <Button asChild className="mt-8 w-full" size="lg">
            <Link href="/book">
              Book this session
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <ServiceReviewDiagnosticButton isAuthenticated={isAuthenticated} />
        </aside>
      </div>
    </main>
  );
}
