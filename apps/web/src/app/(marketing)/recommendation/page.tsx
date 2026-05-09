import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Recommended consultation · IT Advisory',
  description: 'Your tailored consultation recommendation based on the guided diagnostic.',
};

const BENEFITS: readonly string[] = [
  '60–90 minute focused session',
  'Independent, vendor-neutral guidance',
  'Actionable recommendations you can execute',
  'Concise summary notes after the call',
];

export default function RecommendationPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16 md:py-24">
      <p className="text-sm font-medium text-primary">Recommended for you</p>
      <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
        Project Rescue Consultation
      </h1>
      <p className="mt-4 text-pretty text-muted-foreground">
        Based on your answers, a structured rescue session will help you stabilize delivery, clarify
        decisions, and reduce continued spend on the wrong path.
      </p>
      <div className="mt-10 rounded-3xl border border-border bg-card p-8 shadow-xs">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-border pb-8">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Investment</p>
            <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">From ₱6,000</p>
            <p className="text-sm text-muted-foreground">per session · VAT may apply</p>
          </div>
          <Button asChild size="lg">
            <Link href="/service">
              View details & book
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </div>
        <h2 className="mt-8 text-lg font-semibold text-foreground">What you get</h2>
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {BENEFITS.map((benefit) => (
            <li key={benefit} className="flex gap-3 text-sm text-foreground">
              <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="size-3.5" aria-hidden />
              </span>
              {benefit}
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-8 text-center text-sm text-muted-foreground">
        Prefer to revisit your answers?{' '}
        <Link href="/quiz" className="font-medium text-primary underline-offset-4 hover:underline">
          Retake the diagnostic
        </Link>
      </p>
    </main>
  );
}
