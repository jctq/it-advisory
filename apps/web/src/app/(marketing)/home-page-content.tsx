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
import { MarketingParallaxSection } from '@/components/marketing/marketing-parallax-section';
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

/** Capability tags — categorical strip similar to premium agency landing patterns. */
const CAPABILITY_CHIPS: readonly string[] = [
  'Guided diagnostic',
  'Architecture',
  'Vendors & contracts',
  'Automation & AI',
  'Delivery risk',
] as const;

const SPOTLIGHT_ITEMS: readonly { readonly title: string; readonly subtitle: string }[] = [
  {
    title: 'Pain-first routing',
    subtitle: 'Start from what is broken — not from a vendor catalog.',
  },
  {
    title: 'A recommendation you can defend',
    subtitle: 'Independent, documented rationale for stakeholders and finance.',
  },
  {
    title: 'Book when you are ready',
    subtitle: 'Philippine-time slots; focused calls that end with decisions.',
  },
] as const;

const ENGAGEMENT_MODELS: readonly {
  readonly title: string;
  readonly eyebrow: string;
  readonly body: string;
}[] = [
  {
    title: 'Focused consultation',
    eyebrow: 'Decisive session',
    body: 'One structured engagement to stabilize, validate, or plan — tight scope, clear outputs.',
  },
  {
    title: 'Light ongoing advisory',
    eyebrow: 'When you need a steady hand',
    body: 'Short retainer-style support for checkpoints across a program — strategy without bloat.',
  },
] as const;

type HomePageContentProps = {
  readonly isAuthenticated: boolean;
};

export function HomePageContent(props: HomePageContentProps): ReactElement {
  const { navigateToNewQuiz, isNavigating } = useMarketingNewQuizNavigation(props.isAuthenticated);
  const problemCardClassName = cn(
    'group flex h-full w-full flex-col rounded-2xl border border-border/80 bg-card p-5 text-left shadow-sm',
    'transition-[border-color,box-shadow,transform] duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md',
    'hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'hover:bg-card/90 dark:border-border dark:hover:border-primary/35',
  );
  return (
    <main className="relative">
      <MarketingParallaxSection
        className="overflow-hidden border-b border-border px-6 py-24 md:py-32"
        speed={0.11}
        backgroundSpeed={0.2}
        background={
          <>
            <div className="absolute inset-0 marketing-hero-sheen" />
            <div className="absolute inset-0 opacity-[0.55] dark:opacity-[0.35] marketing-dot-fade" />
          </>
        }
      >
        <div className="mx-auto max-w-6xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 text-xs font-medium tracking-wide text-primary shadow-xs backdrop-blur-sm dark:bg-card/60">
            <span className="relative flex size-2">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary/40 opacity-75 motion-reduce:animate-none" />
              <span className="relative inline-flex size-2 rounded-full bg-primary" />
            </span>
            Philippines · Asia/Manila
          </p>
          <h1 className="mt-8 max-w-4xl text-balance text-4xl font-semibold tracking-[-0.03em] text-foreground sm:text-5xl md:text-6xl md:leading-[1.06] lg:text-[3.5rem] lg:leading-[1.05]">
            Solve the right technology problem.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-xl font-medium leading-snug text-foreground/85 md:text-2xl md:leading-snug">
            Independent IT guidance for growing teams — from diagnostic to a decision you can ship.
          </p>
          <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
            Move from confusion to a clear next step — a short guided flow, a tailored recommendation, and
            booking when you are ready.
          </p>
          <ul
            className="mt-10 flex max-w-3xl flex-wrap gap-2"
            aria-label="Focus areas"
          >
            {CAPABILITY_CHIPS.map((chip) => (
              <li key={chip}>
                <span className="inline-flex items-center rounded-full border border-border/70 bg-muted/40 px-3 py-1.5 text-xs font-medium text-foreground/90 backdrop-blur-sm dark:bg-muted/25">
                  {chip}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="group min-h-11 gap-2 shadow-sm"
              disabled={isNavigating}
              onClick={() => void navigateToNewQuiz()}
            >
              {isNavigating ? 'Starting…' : 'Find my solution'}
              <ArrowRight className="size-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5" aria-hidden />
            </Button>
            <Button asChild variant="outline" size="lg" className="min-h-11 border-border/80 bg-background/50 backdrop-blur-sm dark:bg-card/40">
              <Link href="#services">Explore services</Link>
            </Button>
          </div>
          <p className="mt-6 text-sm text-muted-foreground">Takes less than 2 minutes.</p>
        </div>
      </MarketingParallaxSection>
      <MarketingParallaxSection className="border-b border-border/80 px-6 py-14 md:py-20" speed={0.08}>
        <div className="mx-auto max-w-6xl">
          <ul className="divide-y divide-border/70">
            {SPOTLIGHT_ITEMS.map((item) => (
              <li key={item.title}>
                <div className="flex flex-col gap-2 py-8 first:pt-2 last:pb-2 sm:flex-row sm:items-end sm:justify-between sm:gap-8">
                  <div className="min-w-0 space-y-1">
                    <p className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{item.title}</p>
                    <p className="max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base">{item.subtitle}</p>
                  </div>
                  <ArrowRight className="size-6 shrink-0 text-primary/80 sm:mb-1" aria-hidden />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </MarketingParallaxSection>
      <MarketingParallaxSection
        id="how-it-works"
        className="scroll-mt-24 px-6 py-16 md:py-24"
        speed={0.13}
      >
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="max-w-2xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Guided flow</p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">How it works</h2>
            <p className="text-base leading-relaxed text-muted-foreground">
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
                className="relative rounded-2xl border border-border/80 bg-card/80 p-6 shadow-sm backdrop-blur-sm transition-[box-shadow,transform,border-color] duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md dark:bg-card/60"
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">{item.step}</p>
                <h3 className="mt-3 text-lg font-semibold text-foreground">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
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
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </MarketingParallaxSection>
      <MarketingParallaxSection
        id="services"
        className="scroll-mt-24 border-y border-border/80 bg-muted/25 px-6 py-20 md:py-28 dark:bg-muted/15"
        speed={-0.1}
      >
        <div className="mx-auto max-w-6xl space-y-14">
          <div className="max-w-3xl space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Engagements</p>
            <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-5xl md:leading-[1.1]">
              Work with us
            </h2>
            <p className="text-lg leading-relaxed text-muted-foreground md:text-xl">
              Advisory designed for decisions — not endless decks. Start with the diagnostic; we will route you
              to the right shape of help.
            </p>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            {ENGAGEMENT_MODELS.map((model) => (
              <div
                key={model.title}
                className="flex flex-col rounded-3xl border border-border/70 bg-card p-8 shadow-sm md:p-10 dark:bg-card/80"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{model.eyebrow}</p>
                <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{model.title}</h3>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground md:text-base">{model.body}</p>
                <Button
                  type="button"
                  className="mt-8 w-fit min-h-11 gap-2"
                  disabled={isNavigating}
                  onClick={() => void navigateToNewQuiz()}
                >
                  {isNavigating ? 'Starting…' : 'Match me via diagnostic'}
                  <ArrowRight className="size-4" aria-hidden />
                </Button>
              </div>
            ))}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Session types</h3>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Examples of how we help — the diagnostic picks the best fit for your situation.
            </p>
            <div className="mt-8 grid gap-6 md:grid-cols-3">
              {SERVICE_TEASERS.map((service) => (
                <div
                  key={service.title}
                  className="rounded-2xl border border-border/80 bg-background/80 p-6 shadow-sm transition-[box-shadow,transform] duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:hover:shadow-md dark:bg-card/60"
                >
                  <h3 className="text-lg font-semibold text-foreground">{service.title}</h3>
                  <p className="mt-3 text-sm text-muted-foreground">{service.blurb}</p>
                  <button
                    type="button"
                    className="mt-6 inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline disabled:opacity-60"
                    disabled={isNavigating}
                    onClick={() => void navigateToNewQuiz()}
                  >
                    Match me to a session
                    <ArrowRight className="size-4" aria-hidden />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {VALUE_PROPS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="rounded-2xl border border-border/70 bg-background/90 p-5 shadow-sm transition-[box-shadow,border-color] duration-200 motion-safe:hover:shadow-md dark:bg-card/50"
                >
                  <Icon className="size-8 text-primary" aria-hidden />
                  <h3 className="mt-4 font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{item.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </MarketingParallaxSection>
      <MarketingParallaxSection
        id="about"
        className="scroll-mt-24 px-6 py-16 md:py-24"
        speed={0.12}
      >
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">Why we exist</p>
              <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">About</h2>
              <p className="text-muted-foreground">
                TechMD for Growing Businesses helps founders and operators make pragmatic technology
                decisions — especially when vendors, timelines, or internal stakeholders disagree. The goal
                is clarity you can act on this month, not a shelf-ready strategy deck.
              </p>
              <p className="text-muted-foreground">
                Sessions are structured, time-boxed, and documented so your team can align quickly after the
                call.
              </p>
            </div>
            <div className="rounded-2xl border border-border/80 bg-card p-6 shadow-sm ring-1 ring-border/50 dark:bg-card/70">
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
      </MarketingParallaxSection>
      <MarketingParallaxSection className="border-b border-border/80 bg-muted/15 px-6 py-20 md:py-28 dark:bg-muted/10" speed={0.06}>
        <div className="mx-auto max-w-4xl text-center">
          <blockquote className="text-balance text-2xl font-medium leading-snug tracking-tight text-foreground md:text-3xl md:leading-snug">
            <p>
              We optimize for clarity you can act on this quarter — not a shelf-ready strategy deck that gathers
              dust.
            </p>
          </blockquote>
          <p className="mt-8 text-sm font-medium uppercase tracking-wider text-muted-foreground">How we think</p>
        </div>
      </MarketingParallaxSection>
      <MarketingParallaxSection
        id="resources"
        className="scroll-mt-24 px-6 py-20 md:py-28"
        speed={-0.09}
      >
        <div className="mx-auto max-w-6xl space-y-12">
          <div className="rounded-3xl border border-border/80 bg-linear-to-br from-muted/50 via-background to-muted/30 p-8 shadow-sm dark:from-muted/20 dark:via-card/40 dark:to-muted/10 md:p-12">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="max-w-xl space-y-2">
                <h2 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl md:leading-tight">
                  Start with a clear next step.
                </h2>
                <p className="text-base leading-relaxed text-muted-foreground md:text-lg">
                  Run the diagnostic, see what fits, then book — no sprawling intake forms.
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                className="min-h-11 w-full shrink-0 md:w-auto"
                disabled={isNavigating}
                onClick={() => void navigateToNewQuiz()}
              >
                {isNavigating ? 'Starting…' : 'Find my solution'}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">Library</p>
                <h2 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">Resources</h2>
                <p className="max-w-xl text-muted-foreground">
                  References you can share internally — more articles ship after launch.
                </p>
              </div>
            </div>
            <ul className="grid gap-4 md:grid-cols-3">
              {[
                'Buying enterprise software without regrets',
                'Red flags in ERP proposals — a pragmatic checklist',
                'Automation patterns that fail (and what works instead)',
              ].map((title) => (
                <li
                  key={title}
                  className="rounded-xl border border-dashed border-border/80 bg-background/80 px-4 py-5 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:border-primary/40 dark:bg-card/40"
                >
                  <Zap className="mb-3 size-5 text-primary" aria-hidden />
                  {title}
                  <span className="mt-2 block text-xs font-normal text-muted-foreground">Coming soon</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </MarketingParallaxSection>
    </main>
  );
}
