'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BookOpen,
  Briefcase,
  ChevronDown,
  ClipboardList,
  Clock,
  Compass,
  FileText,
  HelpCircle,
  Layers,
  ListChecks,
  Quote,
  Scale,
  ShoppingCart,
  Sparkles,
  Timer,
  Zap,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { MarketingHeroBackground } from '@/components/marketing/marketing-hero-background';
import { useMarketingHeroInteraction } from '@/components/marketing/use-marketing-hero-interaction';
import { MarketingParallaxSection } from '@/components/marketing/marketing-parallax-section';
import { MarketingSectionHeader } from '@/components/marketing/marketing-section-header';
import { MarketingServiceTabs } from '@/components/marketing/marketing-service-tabs';
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

const SERVICE_TAB_ITEMS = [
  {
    id: 'rescue',
    label: 'Project rescue',
    title: 'Project rescue consultation',
    description:
      'Stabilize timelines, clarify ownership, and reduce delivery risk when a program is slipping or already off track.',
    icon: Timer,
  },
  {
    id: 'vendor',
    label: 'Vendor review',
    title: 'Vendor & architecture review',
    description:
      'Validate proposals and contracts before signatures and sunk costs — architecture, scope, and commercial fit.',
    icon: Scale,
  },
  {
    id: 'automation',
    label: 'Automation & AI',
    title: 'Automation & AI readiness',
    description:
      'Pick practical automation paths without boiling the ocean — workflows your team will actually adopt.',
    icon: Sparkles,
  },
] as const;

const STATS: readonly { readonly value: string; readonly label: string; readonly detail: string }[] = [
  { value: '< 2', label: 'Minutes', detail: 'Guided diagnostic — minimal typing, pain-first routing.' },
  { value: '3', label: 'Steps', detail: 'Diagnose, see your recommendation, book when ready.' },
  { value: '100%', label: 'Neutral', detail: 'Independent guidance — not tied to vendor quotas.' },
  { value: 'No', label: 'retainer', detail: 'On-demand sessions when you need judgment — extend only when the program requires it.' },
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

const TESTIMONIALS: readonly {
  readonly quote: string;
  readonly name: string;
  readonly role: string;
}[] = [
  {
    quote:
      'We finally had a recommendation we could take to the board — vendor-neutral, specific, and tied to our timeline.',
    name: 'Operations lead',
    role: 'Growing services company',
  },
  {
    quote:
      'The diagnostic routed us to the right session in minutes. No sprawling intake form before we even knew the fit.',
    name: 'Founder',
    role: 'SME, Metro Manila',
  },
  {
    quote:
      'Clear next steps after one call — not another strategy deck. Exactly what we needed before signing an ERP contract.',
    name: 'Finance & IT',
    role: 'Multi-site operator',
  },
] as const;

const CAPABILITY_CHIPS: readonly string[] = [
  'Guided diagnostic',
  'Architecture',
  'Vendors & contracts',
  'Automation & AI',
  'Delivery risk',
] as const;

type ResourceCategory = 'Guide' | 'Checklist' | 'Playbook';

const RESOURCE_PREP_ITEMS: readonly { readonly title: string; readonly body: string }[] = [
  {
    title: 'Name the decision',
    body: 'What must be true in 90 days — go-live, vendor pick, or stabilization — so the session stays scoped.',
  },
  {
    title: 'Bring the artifacts',
    body: 'Proposals, timelines, org chart, or a one-page problem statement. Redacted excerpts are enough.',
  },
  {
    title: 'List the constraints',
    body: 'Budget band, must-have integrations, regulatory needs, and who can say yes on the call.',
  },
] as const;

const RESOURCE_ITEMS: readonly {
  readonly title: string;
  readonly description: string;
  readonly category: ResourceCategory;
  readonly readLabel: string;
  readonly icon: LucideIcon;
}[] = [
  {
    title: 'Buying enterprise software without regrets',
    description:
      'How to shortlist vendors, score fit beyond demos, and avoid locking scope before you understand operations.',
    category: 'Guide',
    readLabel: '12 min read',
    icon: BookOpen,
  },
  {
    title: 'Red flags in ERP proposals — a pragmatic checklist',
    description:
      'Commercial, technical, and delivery signals to catch before signatures — written for finance and ops reviewers.',
    category: 'Checklist',
    readLabel: '8 min read',
    icon: ClipboardList,
  },
  {
    title: 'Automation patterns that fail (and what works instead)',
    description:
      'Where teams over-invest in AI, when RPA still wins, and how to sequence workflows your staff will adopt.',
    category: 'Guide',
    readLabel: '10 min read',
    icon: FileText,
  },
  {
    title: 'Vendor demos that reveal real fit',
    description:
      'A structured demo script and scorecard so sales theater does not replace proof on your data and processes.',
    category: 'Playbook',
    readLabel: '6 min read',
    icon: ListChecks,
  },
  {
    title: 'Questions before you sign a SaaS contract',
    description:
      'Data ownership, exit terms, SLA credits, implementation assumptions, and who pays for change requests.',
    category: 'Checklist',
    readLabel: '7 min read',
    icon: ClipboardList,
  },
  {
    title: 'Project rescue: the first 48 hours',
    description:
      'Triage order for slipping programs — stakeholders, scope truth, critical path, and what to pause immediately.',
    category: 'Playbook',
    readLabel: '9 min read',
    icon: Zap,
  },
] as const;

type HomePageContentProps = {
  readonly isAuthenticated: boolean;
};

export function HomePageContent(props: HomePageContentProps): ReactElement {
  const { navigateToNewQuiz, isNavigating } = useMarketingNewQuizNavigation(props.isAuthenticated);
  const heroInteraction = useMarketingHeroInteraction();
  const problemCardClassName = cn(
    'group flex h-full w-full flex-col rounded-2xl border border-border/80 bg-card p-5 text-left',
    'marketing-card-elevated transition-[border-color,transform] duration-200 motion-safe:hover:-translate-y-0.5',
    'hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'dark:border-border dark:hover:border-primary/35',
  );
  return (
    <main className="relative">
      <MarketingParallaxSection
        ref={heroInteraction.sectionRef}
        className="relative flex min-h-[88dvh] flex-col justify-end overflow-hidden border-b border-border px-6 pb-14 pt-28 md:min-h-[92dvh] md:pb-20 md:pt-32"
        speed={0.11}
        backgroundSpeed={0}
        background={<MarketingHeroBackground interaction={heroInteraction} />}
      >
        <div className="mx-auto w-full max-w-6xl">
          <p className="marketing-section-eyebrow">TechMD · IT advisory</p>
          <h1 className="mt-6 max-w-4xl text-balance text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl md:text-6xl md:leading-[1.04] lg:text-[3.75rem] lg:leading-[1.02]">
            Grow your business with clearer technology decisions.
          </h1>
          <p className="mt-6 max-w-2xl text-pretty text-xl font-medium leading-snug text-foreground/90 md:text-2xl md:leading-snug">
            Independent guidance for growing teams — from diagnostic to a decision you can ship.
          </p>
          <p className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground">
            A short guided flow, a tailored recommendation, and booking when you are ready — no sprawling intake
            forms.
          </p>
          <ul className="mt-10 flex max-w-3xl flex-wrap gap-2" aria-label="Focus areas">
            {CAPABILITY_CHIPS.map((chip) => (
              <li key={chip}>
                <span className="inline-flex items-center rounded-full border border-primary/15 bg-primary/6 px-3 py-1.5 text-xs font-medium text-foreground/90 shadow-xs backdrop-blur-sm dark:border-border/70 dark:bg-card/50">
                  {chip}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-10 flex flex-wrap gap-3">
            <Button
              size="lg"
              className="marketing-hero-cta group min-h-11 gap-2 bg-transparent hover:bg-transparent dark:bg-primary dark:hover:bg-primary/90"
              disabled={isNavigating}
              onClick={() => void navigateToNewQuiz()}
            >
              {isNavigating ? 'Starting…' : 'Find my solution'}
              <ArrowRight
                className="size-4 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
                aria-hidden
              />
            </Button>
            <Button
              asChild
              variant="outline"
              size="lg"
              className="min-h-11 border-border/80 bg-background/60 shadow-xs backdrop-blur-sm dark:bg-card/40"
            >
              <Link href="#how-it-works">How it works</Link>
            </Button>
          </div>
          <div className="mt-10 flex flex-col gap-8 sm:mt-12 md:mt-14 md:flex-row md:items-end md:justify-between md:gap-6">
            <p className="text-sm text-muted-foreground md:pb-1">Takes less than 2 minutes.</p>
            <a
              href="#proof"
              className="marketing-scroll-cue ml-auto shrink-0 motion-safe:hover:text-foreground md:ml-0"
            >
              <span className="sr-only">Scroll to learn more</span>
              <span className="text-center" aria-hidden>
                Scroll
              </span>
              <span className="flex flex-col items-center" aria-hidden>
                <span className="marketing-scroll-cue-line" />
                <ChevronDown className="size-4 opacity-70" />
              </span>
            </a>
          </div>
        </div>
      </MarketingParallaxSection>
      <MarketingParallaxSection
        id="proof"
        className="scroll-mt-24 border-b border-border/80 px-6 py-16 md:py-20"
        speed={0.07}
      >
        <div className="mx-auto max-w-6xl">
          <MarketingSectionHeader
            eyebrow="At a glance"
            title="Built for decisions, not decks."
            description="Pragmatic metrics from how teams use TechMD — fast routing, neutral advice, and focused on-demand sessions."
            align="center"
          />
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {STATS.map((stat) => (
              <li
                key={stat.label}
                className="marketing-card-elevated rounded-2xl border border-border/70 p-6 transition-transform duration-200 motion-safe:hover:-translate-y-0.5"
              >
                <p className="marketing-stat-value">
                  {stat.value}
                  <span className="ml-1 text-2xl font-medium text-primary md:text-3xl">{stat.label}</span>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{stat.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      </MarketingParallaxSection>
      <section className="marketing-band-dark scroll-mt-24 border-y border-marketing-band-border px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl">
          <MarketingSectionHeader
            eyebrow="Why teams start here"
            title="Clarity before commitment."
            inverted
          />
          <ul className="mt-12 divide-y divide-marketing-band-border">
            {SPOTLIGHT_ITEMS.map((item, index) => (
              <li key={item.title}>
                <div className="flex flex-col gap-3 py-9 first:pt-4 last:pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-10">
                  <div className="min-w-0 space-y-2">
                    <p className="text-xs font-semibold tabular-nums text-marketing-band-subtle">
                      {String(index + 1).padStart(2, '0')}
                    </p>
                    <p className="text-2xl font-semibold tracking-tight text-marketing-band-fg md:text-3xl lg:text-4xl">
                      {item.title}
                    </p>
                    <p className="max-w-xl text-sm leading-relaxed marketing-band-muted md:text-base">{item.subtitle}</p>
                  </div>
                  <ArrowRight className="size-7 shrink-0 text-marketing-band-muted sm:mb-1" aria-hidden />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <MarketingParallaxSection id="how-it-works" className="scroll-mt-24 px-6 py-16 md:py-24" speed={0.13}>
        <div className="mx-auto max-w-6xl space-y-14">
          <MarketingSectionHeader
            eyebrow="Guided flow"
            title="How we work"
            description="Pain-first, guided, fast — three beats: diagnose your situation, see a tailored recommendation, book a focused consultation."
          />
          <ol className="grid gap-5 md:grid-cols-3 md:gap-6">
            {[
              { step: '01', title: 'Answer focused prompts', body: 'Tap options that match reality — minimal typing.' },
              { step: '02', title: 'See your recommendation', body: 'Know which session fits before you invest time.' },
              { step: '03', title: 'Book a slot', body: 'Pick a Philippine-time slot that works for your team.' },
            ].map((item) => (
              <li
                key={item.step}
                className="marketing-card-elevated relative overflow-hidden rounded-2xl border border-border/80 p-6 md:p-8"
              >
                <p
                  className="pointer-events-none absolute -right-2 -top-4 select-none text-[5.5rem] font-semibold leading-none tracking-tighter text-primary/10 md:text-[6.5rem]"
                  aria-hidden
                >
                  {item.step}
                </p>
                <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-primary">{item.step}</p>
                <h3 className="relative mt-4 text-lg font-semibold text-foreground md:text-xl">{item.title}</h3>
                <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
              </li>
            ))}
          </ol>
          <div className="space-y-8 rounded-3xl border border-border/70 bg-muted/30 p-8 md:p-10 dark:bg-muted/15">
            <div className="max-w-2xl space-y-2">
              <h3 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
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
        <div className="mx-auto max-w-6xl space-y-16">
          <MarketingSectionHeader
            eyebrow="Engagements"
            title="We provide focused advisory solutions."
            description="Advisory designed for decisions — not endless decks. Start with the diagnostic; we will route you to the right shape of help."
          />
          <MarketingServiceTabs
            items={SERVICE_TAB_ITEMS}
            isNavigating={isNavigating}
            onStartDiagnostic={() => void navigateToNewQuiz()}
          />
          <div className="grid gap-6 lg:grid-cols-2">
            {ENGAGEMENT_MODELS.map((model) => (
              <div
                key={model.title}
                className="marketing-card-elevated flex flex-col rounded-3xl border border-border/70 p-8 md:p-10"
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
            <MarketingSectionHeader eyebrow="Primary benefits" title="Why choose TechMD?" />
            <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
              {VALUE_PROPS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="marketing-card-elevated rounded-2xl border border-border/70 p-6 transition-transform duration-200 motion-safe:hover:-translate-y-0.5"
                  >
                    <Icon className="size-8 text-primary" aria-hidden />
                    <h3 className="mt-4 font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </MarketingParallaxSection>
      <section className="marketing-band-dark px-6 py-16 md:py-24">
        <div className="mx-auto max-w-6xl space-y-10">
          <MarketingSectionHeader
            eyebrow="Trusted approach"
            title="Teams come back for clarity they can act on."
            inverted
            align="center"
          />
          <ul className="grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <li
                key={item.quote}
                className="marketing-band-card rounded-2xl p-6 backdrop-blur-sm md:p-8"
              >
                <Quote className="size-8 text-marketing-band-subtle" aria-hidden />
                <blockquote className="mt-4 text-pretty text-base leading-relaxed text-marketing-band-fg/90">
                  {item.quote}
                </blockquote>
                <footer className="mt-6 border-t border-marketing-band-border pt-4">
                  <p className="font-semibold text-marketing-band-fg">{item.name}</p>
                  <p className="mt-1 text-sm marketing-band-muted">{item.role}</p>
                </footer>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <MarketingParallaxSection id="about" className="scroll-mt-24 px-6 py-16 md:py-24" speed={0.12}>
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div className="space-y-6">
              <MarketingSectionHeader
                eyebrow="Our story"
                title="Better way to make technology decisions."
                description="TechMD for Growing Businesses helps founders and operators make pragmatic technology decisions — especially when vendors, timelines, or internal stakeholders disagree."
              />
              <p className="text-muted-foreground">
                Sessions are structured, time-boxed, and documented so your team can align quickly after the call.
                The goal is clarity you can act on this month, not a shelf-ready strategy deck.
              </p>
              <Button asChild variant="outline" className="min-h-11">
                <Link href="/diagnostic">Learn more via diagnostic</Link>
              </Button>
            </div>
            <div className="marketing-card-elevated relative overflow-hidden rounded-3xl border border-border/80 p-8 md:p-10">
              <div className="absolute -right-8 -top-8 size-40 rounded-full bg-primary/10 blur-2xl" aria-hidden />
              <div className="relative flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Compass className="size-6" aria-hidden />
                </span>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Why a guided diagnostic?</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                    Starting from pain reduces bias and speeds routing. You get a recommendation that fits your
                    situation — not a generic services catalog.
                  </p>
                </div>
              </div>
              <div className="relative mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-muted/40 p-4 dark:bg-muted/20">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Mission</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Help businesses establish a strong digital foundation with vendor-neutral judgment.
                  </p>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/40 p-4 dark:bg-muted/20">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Focus</p>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Responsive design for decisions — intuitive paths from problem to booked session.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </MarketingParallaxSection>
      <MarketingParallaxSection
        id="resources"
        className="scroll-mt-24 px-6 py-20 md:py-28"
        speed={-0.09}
      >
        <div className="mx-auto max-w-6xl space-y-16">
          <MarketingSectionHeader
            eyebrow="Resources"
            title="Practical references for technology decisions."
            description="Guides, checklists, and playbooks you can forward to finance, ops, or IT — written for growing teams making vendor, delivery, and automation calls."
          />
          <div className="marketing-band-dark relative overflow-hidden rounded-3xl px-8 py-12 shadow-lg md:px-14 md:py-16">
            <div
              className="pointer-events-none absolute inset-0 opacity-40 marketing-service-panel-glow"
              aria-hidden
            />
            <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
              <div className="max-w-xl space-y-3">
                <p className="marketing-section-eyebrow">Start a project</p>
                <h2 className="text-balance text-3xl font-semibold tracking-tight text-marketing-band-fg md:text-4xl md:leading-tight">
                  Let&apos;s start productive work.
                </h2>
                <p className="text-base leading-relaxed marketing-band-muted md:text-lg">
                  Run the diagnostic, see what fits, then book — no sprawling intake forms. Use the library below to
                  align stakeholders before or after your session.
                </p>
              </div>
              <Button
                type="button"
                size="lg"
                className="min-h-11 w-full shrink-0 shadow-md md:w-auto"
                disabled={isNavigating}
                onClick={() => void navigateToNewQuiz()}
              >
                {isNavigating ? 'Starting…' : 'Find my solution'}
                <ArrowRight className="size-4" aria-hidden />
              </Button>
            </div>
          </div>
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <div className="marketing-card-elevated rounded-3xl border border-border/80 p-8 md:p-10">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Before your session</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">Come prepared, leave with decisions.</h3>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
                Focused calls work best when the room shares context. These three beats are enough — you do not need a
                full requirements document.
              </p>
              <ol className="mt-8 space-y-6">
                {RESOURCE_PREP_ITEMS.map((item, index) => (
                  <li key={item.title} className="flex gap-4">
                    <span
                      className="flex size-9 shrink-0 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-sm font-semibold tabular-nums text-primary"
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-semibold text-foreground">{item.title}</p>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <div className="space-y-6">
              <div className="rounded-2xl border border-border/70 bg-muted/30 p-6 dark:bg-muted/15 md:p-8">
                <h3 className="text-lg font-semibold text-foreground">What the library covers</h3>
                <ul className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
                  <li>
                    <span className="font-medium text-foreground">Vendor selection</span> — demos, proposals, and
                    contract questions before you commit.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Delivery risk</span> — rescue triage when timelines
                    slip or ownership is unclear.
                  </li>
                  <li>
                    <span className="font-medium text-foreground">Automation & AI</span> — practical sequencing, not
                    hype-first roadmaps.
                  </li>
                </ul>
                <p className="mt-5 text-xs text-muted-foreground">
                  Full articles publish on a rolling basis. Start with the diagnostic for a recommendation matched to
                  your situation.
                </p>
              </div>
              <ul className="flex flex-wrap gap-2" aria-label="Resource formats">
                {(['Guide', 'Checklist', 'Playbook'] as const).map((format) => (
                  <li key={format}>
                    <span className="inline-flex items-center rounded-full border border-border/70 bg-background/85 px-3 py-1.5 text-xs font-medium text-foreground/90">
                      {format}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="space-y-8">
            <MarketingSectionHeader
              eyebrow="Library"
              title="References you can share internally"
              description="Each piece is vendor-neutral and written for operators — use them in steering committees, vendor reviews, or pre-reads before booking."
            />
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {RESOURCE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <li
                    key={item.title}
                    className="marketing-card-elevated group flex h-full flex-col rounded-2xl border border-border/80 p-6 transition-transform duration-200 motion-safe:hover:-translate-y-0.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="size-5" aria-hidden />
                      </span>
                      <span className="rounded-full border border-border/70 px-2.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
                        {item.category}
                      </span>
                    </div>
                    <h3 className="mt-4 font-semibold leading-snug text-foreground">{item.title}</h3>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                    <div className="mt-5 flex items-center justify-between gap-3 border-t border-border/60 pt-4">
                      <span className="text-xs text-muted-foreground">{item.readLabel}</span>
                      <span className="text-xs font-medium text-primary">Coming soon</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </MarketingParallaxSection>
    </main>
  );
}
