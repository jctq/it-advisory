'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Clock,
  Compass,
  HelpCircle,
  Layers,
  Scale,
  ShoppingCart,
  Sparkles,
  Timer,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { useMarketingNewQuizNavigation } from '@/components/marketing/marketing-new-quiz-session-client';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PROBLEM_ITEMS: readonly {
  readonly title: string;
  readonly description: string;
  readonly icon: LucideIcon;
}[] = [
  {
    title: 'Planning to buy software',
    description: 'Shortlist vendors and avoid costly mismatches before you commit.',
    icon: ShoppingCart,
  },
  {
    title: 'Project is delayed or failing',
    description: 'Get clarity on risks, gaps, and the fastest path to stabilization.',
    icon: Timer,
  },
  {
    title: 'Want to automate or use AI',
    description: 'Separate hype from practical workflows that your team will adopt.',
    icon: Sparkles,
  },
  {
    title: 'Processes are inefficient',
    description: 'Map bottlenecks and prioritize fixes that move revenue or margin.',
    icon: Layers,
  },
  {
    title: 'Unsure what technology is needed',
    description: 'Translate goals into a sane roadmap without locking in too early.',
    icon: HelpCircle,
  },
] as const;

const VALUE_PROPS: readonly { readonly title: string; readonly body: string; readonly icon: LucideIcon }[] = [
  {
    title: 'Independent & vendor-neutral',
    body: 'Recommendations tied to your outcomes — not a reseller quota.',
    icon: Scale,
  },
  {
    title: 'Enterprise experience',
    body: 'Patterns from complex rollouts, distilled for growing teams.',
    icon: Briefcase,
  },
  {
    title: 'Clear & actionable',
    body: 'Concrete next steps you can execute this quarter.',
    icon: BadgeCheck,
  },
  {
    title: 'On-demand',
    body: 'Focused sessions when you need judgment — not a long retainer.',
    icon: Clock,
  },
];

const SERVICE_TEASERS: readonly { readonly title: string; readonly blurb: string }[] = [
  {
    title: 'Project rescue consultation',
    blurb: 'Stabilize timelines, clarify ownership, and reduce delivery risk.',
  },
  {
    title: 'Vendor & architecture review',
    blurb: 'Validate proposals and contracts before signatures and sunk costs.',
  },
  {
    title: 'Automation & AI readiness',
    blurb: 'Pick practical automation paths without boiling the ocean.',
  },
] as const;

type HomePageContentProps = {
  readonly isAuthenticated: boolean;
};

export function HomePageContent(props: HomePageContentProps): ReactElement {
  const { navigateToNewQuiz, isNavigating } = useMarketingNewQuizNavigation(props.isAuthenticated);
  const problemCardClassName = cn(
    'flex h-full w-full flex-col rounded-2xl border border-border bg-card p-5 text-left shadow-xs transition-colors',
    'hover:border-primary/35 hover:bg-muted/40',
  );
  return (
    <main>
      <section className="border-b border-border bg-linear-to-b from-muted/40 to-background px-6 py-20 md:py-28">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-medium tracking-wide text-primary">Philippines · Asia/Manila</p>
          <h1 className="mt-4 max-w-3xl text-balance text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
            Solve the right technology problem.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-lg text-muted-foreground">
            Growing businesses use this guided diagnostic to move from confusion to a clear next step —
            independent advice, actionable recommendations, and booking when you are ready.
          </p>
          <div className="mt-10 flex flex-wrap gap-3">
            {props.isAuthenticated ? (
              <Button size="lg" disabled={isNavigating} onClick={() => void navigateToNewQuiz()}>
                {isNavigating ? 'Starting…' : 'Find my solution'}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link href="/quiz">
                  Find my solution
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </Button>
            )}
            <Button asChild variant="outline" size="lg">
              <Link href="#services">Explore services</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Takes less than 2 minutes.</p>
        </div>
      </section>
      <section id="how-it-works" className="scroll-mt-24 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="max-w-2xl space-y-4">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">How it works</h2>
            <p className="text-muted-foreground">
              Pain-first, guided, fast — no sprawling intake forms. Three beats: diagnose your situation,
              see a tailored recommendation, book a focused consultation.
            </p>
          </div>
          <ol className="grid gap-6 md:grid-cols-3">
            {[
              { step: '01', title: 'Answer focused prompts', body: 'Tap options that match reality — minimal typing.' },
              { step: '02', title: 'See your recommendation', body: 'Know which session fits before you invest time.' },
              { step: '03', title: 'Book a slot', body: 'Pick a Philippine-time slot that works for your team.' },
            ].map((item) => (
              <li
                key={item.step}
                className="rounded-2xl border border-border bg-card p-6 shadow-xs"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">{item.step}</p>
                <h3 className="mt-3 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ol>
          <div className="space-y-6">
            <div className="max-w-2xl space-y-2">
              <h3 className="text-2xl font-semibold tracking-tight text-foreground">
                What business or IT problem are you facing?
              </h3>
              <p className="text-muted-foreground">
                Choose the closest match — you can refine details in the guided diagnostic.
              </p>
            </div>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {PROBLEM_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.title}>
                    {props.isAuthenticated ? (
                      <button
                        type="button"
                        className={problemCardClassName}
                        disabled={isNavigating}
                        onClick={() => void navigateToNewQuiz()}
                      >
                        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="mt-4 font-semibold text-foreground">{item.title}</span>
                        <span className="mt-2 text-sm text-muted-foreground">{item.description}</span>
                        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                          Start diagnostic
                          <ArrowRight className="size-4" aria-hidden />
                        </span>
                      </button>
                    ) : (
                      <Link href="/quiz" className={problemCardClassName}>
                        <span className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="size-5" aria-hidden />
                        </span>
                        <span className="mt-4 font-semibold text-foreground">{item.title}</span>
                        <span className="mt-2 text-sm text-muted-foreground">{item.description}</span>
                        <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                          Start diagnostic
                          <ArrowRight className="size-4" aria-hidden />
                        </span>
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </section>
      <section id="services" className="scroll-mt-24 border-y border-border bg-muted/30 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl space-y-10">
          <div className="max-w-2xl space-y-3">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">Services</h2>
            <p className="text-muted-foreground">
              Advisory sessions designed for decisions — not endless decks. Start with the guided quiz to
              route you to the right engagement.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {SERVICE_TEASERS.map((service) => (
              <div key={service.title} className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                <h3 className="text-lg font-semibold text-foreground">{service.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground">{service.blurb}</p>
                {props.isAuthenticated ? (
                  <button
                    type="button"
                    className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-60"
                    disabled={isNavigating}
                    onClick={() => void navigateToNewQuiz()}
                  >
                    Match me to a session
                    <ArrowRight className="size-4" aria-hidden />
                  </button>
                ) : (
                  <Link
                    href="/quiz"
                    className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Match me to a session
                    <ArrowRight className="size-4" aria-hidden />
                  </Link>
                )}
              </div>
            ))}
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {VALUE_PROPS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-border bg-background p-5">
                  <Icon className="size-8 text-primary" aria-hidden />
                  <h3 className="mt-4 font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section id="about" className="scroll-mt-24 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="space-y-4">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">About</h2>
              <p className="text-muted-foreground">
                IT Advisory for Growing Businesses helps founders and operators make pragmatic technology
                decisions — especially when vendors, timelines, or internal stakeholders disagree. The goal
                is clarity you can act on this month, not a shelf-ready strategy deck.
              </p>
              <p className="text-muted-foreground">
                Sessions are structured, time-boxed, and documented so your team can align quickly after the
                call.
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
              <div className="flex items-start gap-3">
                <Compass className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
                <div>
                  <h3 className="font-semibold text-foreground">Why a guided diagnostic?</h3>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Starting from pain reduces bias and speeds routing. You get a recommendation that fits your
                    situation — not a generic services catalog.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
      <section id="resources" className="scroll-mt-24 border-t border-border bg-muted/20 px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
              <h2 className="text-3xl font-semibold tracking-tight text-foreground">Resources</h2>
              <p className="text-muted-foreground">
                References you can share internally — more articles ship after launch.
              </p>
            </div>
            {props.isAuthenticated ? (
              <Button variant="outline" disabled={isNavigating} onClick={() => void navigateToNewQuiz()}>
                {isNavigating ? 'Starting…' : 'Start with the diagnostic'}
              </Button>
            ) : (
              <Button asChild variant="outline">
                <Link href="/quiz">Start with the diagnostic</Link>
              </Button>
            )}
          </div>
          <ul className="grid gap-4 md:grid-cols-3">
            {[
              'Buying enterprise software without regrets',
              'Red flags in ERP proposals — a pragmatic checklist',
              'Automation patterns that fail (and what works instead)',
            ].map((title) => (
              <li
                key={title}
                className="rounded-xl border border-dashed border-border bg-background px-4 py-5 text-sm font-medium text-muted-foreground"
              >
                <Zap className="mb-3 size-5 text-primary" aria-hidden />
                {title}
                <span className="mt-2 block text-xs font-normal text-muted-foreground">Coming soon</span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
