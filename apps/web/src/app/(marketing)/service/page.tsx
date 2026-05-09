import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Project Rescue Consultation · IT Advisory',
  description:
    'Structured consultation to stabilize timelines, clarify ownership, and reduce delivery risk.',
};

const INCLUDED: readonly string[] = [
  'Review of current situation, stakeholders, and constraints',
  'Identification of delivery risks and likely root causes',
  'Decision checkpoints and options ranked by impact vs effort',
  'Vendor / SI dynamics — what to challenge and what to formalize',
  '90-day stabilization roadmap outline',
];

export default function ServiceDetailPage() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-16 md:py-24">
      <div className="grid gap-12 lg:grid-cols-[1fr_320px] lg:items-start">
        <div>
          <p className="text-sm font-medium text-primary">Service detail</p>
          <h1 className="mt-3 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            Project Rescue Consultation
          </h1>
          <p className="mt-4 text-pretty text-lg text-muted-foreground">
            A focused working session for leaders who need independent judgment — especially when timelines
            slip, scope churns, or vendors point fingers.
          </p>
          <div className="mt-10 rounded-2xl border border-border bg-card p-6 shadow-xs">
            <h2 className="text-lg font-semibold text-foreground">What&apos;s included</h2>
            <ul className="mt-5 space-y-4">
              {INCLUDED.map((item) => (
                <li key={item} className="flex gap-3 text-sm text-foreground">
                  <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-10 rounded-2xl border border-dashed border-border bg-muted/30 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              Good fit if
            </h2>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
              <li>You are mid-flight on an ERP, HRIS, CRM, or custom build</li>
              <li>Executive sponsors need a neutral read before approving more spend</li>
              <li>You want concrete next steps — not another steering deck</li>
            </ul>
          </div>
        </div>
        <aside className="rounded-3xl border border-border bg-card p-8 shadow-xs lg:sticky lg:top-24">
          <p className="text-sm font-medium text-muted-foreground">Duration</p>
          <p className="mt-2 text-2xl font-semibold text-foreground">60–90 minutes</p>
          <p className="mt-6 text-sm font-medium text-muted-foreground">Investment</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-foreground">From ₱6,000</p>
          <p className="mt-2 text-sm text-muted-foreground">per session · delivered remotely by default</p>
          <Button asChild className="mt-8 w-full" size="lg">
            <Link href="/book">
              Book this session
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
          <Button asChild variant="outline" className="mt-3 w-full">
            <Link href="/recommendation">Back to recommendation</Link>
          </Button>
        </aside>
      </div>
    </main>
  );
}
