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
import { MarketingSectionArt } from '@/components/marketing/marketing-section-art';
import { MarketingSectionReveal } from '@/components/marketing/marketing-section-reveal';
import { useMarketingHeroInteraction } from '@/components/marketing/use-marketing-hero-interaction';
import { MarketingParallaxSection } from '@/components/marketing/marketing-parallax-section';
import { MarketingSectionHeader } from '@/components/marketing/marketing-section-header';
import { MarketingServiceTabs } from '@/components/marketing/marketing-service-tabs';
import { MarketingNewQuizCtaLabel } from '@/components/marketing/marketing-new-quiz-cta-label';
import { useMarketingNewQuizNavigation } from '@/components/marketing/marketing-new-quiz-session-client';
import { Button } from '@/components/ui/button';
import {
  MARKETING_CASE_STUDIES_SECTION_ID,
  SHOW_HOME_RESOURCES_SECTION,
} from '@/lib/marketing/marketing-explore-nav-links';
import type { PublishedMarketingTestimonial } from '@/lib/testimonial-types';
import { cn } from '@/lib/utils';

const PROBLEM_ITEMS: readonly {
  readonly title: string;
  readonly description: string;
  readonly examples?: string;
  readonly icon: LucideIcon;
}[] = [
  {
    title: 'Systems and Processes Are Inefficient',
    description:
      'Understand where bottlenecks, manual work, disconnected systems, and operational waste are slowing your organization down.',
    examples: 'Duplicate Data Entry, Spreadsheet Dependency, Approval Delays',
    icon: Sparkles,
  },
  {
    title: 'Planning to Buy or Upgrade Software',
    description: 'Evaluate solutions with confidence and avoid costly vendor, feature, or implementation mismatches.',
    examples: 'ERP, CRM, HRIS, Accounting, Inventory, POS, Custom Software',
    icon: ShoppingCart,
  },
  {
    title: 'Software Project is Delayed or Struggling',
    description: 'Identify project risks, implementation gaps, vendor issues, and recovery options before costs continue to escalate.',
    examples: 'Delays, Scope Creep, Budget Overruns, Low User Adoption',
    icon: Timer,
  },
  {
    title: 'Looking to Automate or Leverage AI',
    description: 'Discover practical automation and AI opportunities that improve efficiency and deliver measurable business value.',
    examples: 'Workflow Automation, AI Assistants, Reporting, Process Digitization',
    icon: Layers,
  },
  {
    title: 'Not Sure What Technology You Need',
    description: 'Get independent guidance to translate business goals into a practical technology roadmap without committing too early.',
    examples: 'Digital Transformation, Modernization, Growth Planning',
    icon: HelpCircle,
  },
] as const;

const VALUE_PROPS: readonly { readonly title: string; readonly body: string; readonly icon: LucideIcon }[] = [
  {
    title: 'Independent Perspective',
    body: "Make decisions based on what's right for your organization—not what's easiest to sell.",
    icon: Scale,
  },
  {
    title: 'Proven Implementation Experience',
    body: 'Leverage lessons learned from complex software implementations and technology initiatives.',
    icon: Briefcase,
  },
  {
    title: 'Actionable Recommendations',
    body: 'Receive practical guidance with clear next steps and measurable outcomes.',
    icon: BadgeCheck,
  },
  {
    title: 'Flexible Engagement Model',
    body: 'Access expert advice when you need it, without ongoing consulting overhead.',
    icon: Clock,
  },
];

const SERVICE_TAB_ITEMS = [
  {
    id: 'rescue',
    label: 'Improve Processes & Reduce Inefficiencies',
    title: 'Improve Processes & Reduce Inefficiencies',
    description:
      'Understand where time, effort, and money are being lost—and identify practical opportunities for improvement and automation.',
    icon: Timer,
  },
  {
    id: 'vendor',
    label: 'Recover Delayed or At-Risk Projects',
    title: 'Recover Delayed or At-Risk Projects',
    description:
      'Address implementation challenges, delivery risks, vendor issues, and adoption concerns before they impact business outcomes.',
    icon: Scale,
  },
  {
    id: 'automation',
    label: 'Select the Right Software with Confidence',
    title: 'Select the Right Software with Confidence',
    description:
      'Avoid costly mistakes by validating requirements, evaluating options, and choosing solutions that fit your organization.',
    icon: Sparkles,
  },
] as const;

const STATS: readonly { readonly value: string; readonly label: string; readonly detail: string }[] = [
  {
    value: '100%',
    label: 'Independent',
    detail: 'No vendor commissions, quotas, or software sales incentives.',
  },
  {
    value: '0',
    label: 'Sales Pressure',
    detail: 'Advice focused on solving problems—not selling products.',
  },
  {
    value: '1',
    label: 'Clear Recommendation',
    detail: 'A tailored path forward based on your specific situation.',
  },
  {
    value: 'Pay',
    label: 'Only When Needed',
    detail: 'No retainers or long-term consulting commitments.',
  },
] as const;

const HOW_IT_WORKS_STEPS: readonly {
  readonly step: string;
  readonly title: string;
  readonly body: string;
}[] = [
  { step: '01', title: 'Assess Your Situation', body: 'Help us understand your challenges, objectives, and technology landscape.' },
  { step: '02', title: "Get a Recommended Path Forward", body: "Receive tailored recommendations designed around your needs—not a vendor's agenda." },
  { step: '03', title: 'Engage an Expert When Needed', body: 'Book a focused consultation to validate decisions, reduce risks, and accelerate outcomes.' },
] as const;

const SPOTLIGHT_ITEMS: readonly { readonly title: string; readonly subtitle: string }[] = [
  {
    title: 'Understand the real problem first',
    subtitle: "Avoid investing in solutions that don't address the underlying issue.",
  },
  {
    title: 'Get recommendations you can trust',
    subtitle: 'Independent, vendor-neutral guidance focused on your business needs.',
  },
  {
    title: 'Move forward with confidence',
    subtitle: 'Make informed technology decisions backed by expert advice and practical experience.',
  },
] as const;

const ENGAGEMENT_MODELS: readonly {
  readonly title: string;
  readonly eyebrow: string;
  readonly body: readonly string[];
  readonly bestFor?: readonly string[];
  readonly ctaLabel: string;
}[] = [
  {
    eyebrow: 'Decision support',
    title: 'Focused Expert Consultation',
    body: [
      'A structured advisory session designed to help you validate decisions, evaluate options, and solve specific technology challenges.',
      "Whether you're selecting software, reviewing vendors, planning implementations, or assessing project risks, get direct access to independent expertise.",
    ],
    bestFor: ['Software selection', 'Vendor evaluation', 'Project reviews', 'Technology planning'],
    ctaLabel: 'Book a Consultation',
  },
  {
    eyebrow: 'Ongoing guidance',
    title: 'Consultation Partnership',
    body: [
      'For organizations navigating larger technology initiatives, ongoing advisory support provides periodic reviews, implementation guidance, risk management, and executive-level decision support.',
      'Stay aligned, reduce risk, and gain an independent perspective throughout your technology journey.',
    ],
    bestFor: [
      'ERP implementations',
      'Digital transformation programs',
      'Multi-vendor initiatives',
      'Technology modernization efforts',
    ],
    ctaLabel: 'Explore Advisory Support',
  },
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
  readonly siteName: string;
  readonly reviewsModuleEnabled: boolean;
  readonly testimonials: readonly PublishedMarketingTestimonial[];
};

export function HomePageContent(props: HomePageContentProps): ReactElement {
  const { isAuthenticated, siteName, reviewsModuleEnabled, testimonials } = props;
  const showTestimonialsSection = reviewsModuleEnabled && testimonials.length > 0;
  const { navigateToNewQuiz, isNavigating } = useMarketingNewQuizNavigation(isAuthenticated);
  const { sectionRef: heroSectionRef, isBoosted, isInView, rootStyle } = useMarketingHeroInteraction();
  const problemCardClassName = cn(
    'group flex h-full w-full flex-col rounded-2xl border border-border/80 bg-card p-5 text-left',
    'marketing-card-elevated transition-[border-color,transform] duration-200 motion-safe:hover:-translate-y-0.5',
    'hover:border-primary/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    'dark:border-border dark:hover:border-primary/35',
  );
  return (
    <main className="relative">
      <MarketingParallaxSection
        ref={heroSectionRef}
        reveal={false}
        className="relative flex min-h-[88dvh] flex-col justify-end border-b border-border px-6 pb-14 pt-28 md:min-h-[92dvh] md:pb-20 md:pt-32"
        speed={0.11}
        backgroundSpeed={0}
        background={<MarketingHeroBackground interaction={{ isBoosted, isInView, rootStyle }} />}
      >
        <div className="mx-auto w-full min-w-0 max-w-6xl">
          <div className="max-w-2xl min-w-0">
            <h1 className="text-balance text-4xl font-semibold tracking-[-0.04em] text-foreground sm:text-5xl md:text-6xl md:leading-[1.04] lg:text-[3.75rem] lg:leading-[1.02]">
              Every technology problem has a root cause.
            </h1>
            <p className="mt-6 text-pretty text-xl font-medium leading-snug text-foreground/90 md:text-2xl md:leading-snug">
              Identify the challenges affecting your systems, processes, and software investments before they become
              costly problems
            </p>
            <p className="mt-4 text-pretty text-base leading-relaxed text-muted-foreground">
              A guided assessment, tailored recommendations, and expert consultation — all designed to help you make
              smarter technology decisions.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Button
                type="button"
                size="lg"
                className="marketing-hero-cta group inline-flex h-11 items-center gap-2 bg-transparent active:translate-y-0 hover:bg-transparent dark:bg-primary dark:hover:bg-primary/90"
                disabled={isNavigating}
                onClick={() => void navigateToNewQuiz()}
              >
                <MarketingNewQuizCtaLabel isNavigating={isNavigating} />
                <ArrowRight
                  className="size-4 shrink-0 motion-safe:transition-transform motion-safe:group-hover:translate-x-0.5"
                  aria-hidden
                />
              </Button>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-8 sm:mt-12 md:mt-14 md:flex-row md:items-end md:justify-between md:gap-6">
            <p className="text-sm text-muted-foreground md:pb-1">Assessment takes less than 5 minutes.</p>
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
        reveal={false}
        className="scroll-mt-24 border-b border-border/80 px-6 py-16 md:py-20"
        speed={0.07}
      >
        <div className="relative mx-auto max-w-6xl overflow-hidden">
          <div
            className="marketing-section-art-layer pointer-events-none absolute -right-8 top-8 hidden h-56 w-72 md:block lg:h-64 lg:w-80"
            aria-hidden
          >
            <MarketingSectionArt variant="metrics" />
          </div>
          <MarketingSectionHeader
            reveal
            eyebrow="At a glance"
            title="Make technology decisions with confidence."
            description="Independent assessments, tailored recommendations, and expert guidance to help you navigate software, systems, and implementation challenges."
            align="center"
          />
          <MarketingSectionReveal
            className="relative mt-12 grid gap-6 sm:grid-cols-2"
            stagger
          >
            {STATS.map((stat) => (
              <div
                key={stat.label || stat.value}
                className="marketing-stat-card rounded-2xl border border-border/60 p-6 transition-[transform,box-shadow,border-color] duration-200 motion-safe:hover:-translate-y-0.5 dark:border-border/50"
              >
                <p className="marketing-stat-value">
                  {stat.value}
                  {stat.label ? (
                    <span className="ml-1 text-2xl font-medium text-primary md:text-3xl">{stat.label}</span>
                  ) : null}
                </p>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{stat.detail}</p>
              </div>
            ))}
          </MarketingSectionReveal>
        </div>
      </MarketingParallaxSection>
      <MarketingParallaxSection
        reveal={false}
        className="marketing-band-dark relative scroll-mt-24 overflow-hidden border-y border-marketing-band-border px-6 py-16 md:py-24"
        speed={0}
      >
        <div
          className="marketing-section-art-layer pointer-events-none absolute -left-6 bottom-0 hidden h-48 w-64 md:block lg:h-56 lg:w-72"
          aria-hidden
        >
          <MarketingSectionArt variant="spotlight" />
        </div>
        <div className="relative mx-auto max-w-6xl">
          <MarketingSectionHeader
            reveal
            eyebrow={`WHY START HERE @ ${siteName}`}
            title="Clarity before commitment."
            description={`Technology decisions can impact your operations, costs, and growth for years. ${siteName} helps you identify the real problem, evaluate your options, and move forward with confidence before investing in software, vendors, or implementation projects.`}
            inverted
          />
          <MarketingSectionReveal as="ul" className="mt-12 divide-y divide-marketing-band-border" stagger>
            {SPOTLIGHT_ITEMS.map((item, index) => (
              <div
                key={item.title}
                className="flex flex-col gap-3 py-9 first:pt-4 last:pb-4 sm:flex-row sm:items-end sm:justify-between sm:gap-10"
              >
                <div className="min-w-0 space-y-2">
                  <p className="text-xs font-semibold tabular-nums text-marketing-band-subtle">
                    {String(index + 1).padStart(2, '0')}
                  </p>
                  <p className="text-2xl font-semibold tracking-tight text-marketing-band-fg md:text-3xl lg:text-4xl">
                    {item.title}
                  </p>
                  <p className="max-w-xl text-sm leading-relaxed marketing-band-muted md:text-base">{item.subtitle}</p>
                </div>
              </div>
            ))}
          </MarketingSectionReveal>
        </div>
      </MarketingParallaxSection>
      <MarketingParallaxSection id="how-it-works" reveal={false} className="scroll-mt-24 px-6 py-16 md:py-24" speed={0.13}>
        <div className="mx-auto max-w-6xl space-y-14">
          <MarketingSectionHeader
            reveal
            eyebrow="HOW IT WORKS"
            title="Diagnose. Decide. Move forward."
            description="Technology decisions shouldn't start with software demos or vendor sales pitches."
          />
          <div className="relative">
            <div
              className="marketing-section-art-layer marketing-section-art-fade-bottom pointer-events-none absolute inset-x-0 -top-4 hidden h-40 md:block"
              aria-hidden
            >
              <MarketingSectionArt variant="process" className="mx-auto max-w-3xl opacity-80" />
            </div>
            <MarketingSectionReveal
              as="ol"
              className="relative grid list-none gap-5 p-0 md:grid-cols-3 md:gap-6"
              stagger
            >
              {HOW_IT_WORKS_STEPS.map((item) => (
                <div
                  key={item.step}
                  className="marketing-card-elevated relative z-1 flex h-full flex-col overflow-hidden rounded-2xl border border-border/80 p-6 md:p-8"
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
                </div>
              ))}
            </MarketingSectionReveal>
          </div>
          <div className="space-y-8 rounded-3xl border border-border/70 bg-muted/30 p-8 md:p-10 dark:bg-muted/15">
            <MarketingSectionReveal stagger className="max-w-2xl space-y-2">
              <h3 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
                What technology challenge are you trying to solve?
              </h3>
              <p className="text-muted-foreground">
                Select the option that best describes your situation. We&apos;ll help identify the root cause and recommend the most effective path forward.
              </p>
            </MarketingSectionReveal>
            <MarketingSectionReveal className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" stagger>
              {PROBLEM_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.title}
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
                    {item.examples ? (
                      <span className="mt-2 text-sm text-muted-foreground">
                        <span className="font-semibold text-foreground">Examples: </span>
                        {item.examples}
                      </span>
                    ) : null}
                    <span className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-medium text-primary">
                      Start Assessment
                      <ArrowRight className="size-4" aria-hidden />
                    </span>
                  </button>
                );
              })}
            </MarketingSectionReveal>
          </div>
        </div>
      </MarketingParallaxSection>
      <MarketingParallaxSection
        id="services"
        reveal={false}
        className="scroll-mt-24 border-y border-border/80 bg-muted/25 px-6 py-20 md:py-28 dark:bg-muted/15"
        speed={-0.1}
      >
        <div className="mx-auto max-w-6xl space-y-16">
          <MarketingSectionHeader
            reveal
            eyebrow="Engagement Options"
            title="Navigate technology decisions with confidence."
            description={`Whether you're evaluating software, recovering a struggling project, or planning your next technology investment, ${siteName} provides independent advice tailored to your needs.`}
          />
          <MarketingSectionReveal stagger>
            <MarketingServiceTabs
              items={SERVICE_TAB_ITEMS}
              isNavigating={isNavigating}
              onStartDiagnostic={() => void navigateToNewQuiz()}
            />
          </MarketingSectionReveal>
          <MarketingSectionReveal className="grid gap-6 lg:grid-cols-2 lg:items-stretch" stagger>
            {ENGAGEMENT_MODELS.map((model, index) => (
              <div
                key={model.title}
                className="marketing-card-elevated relative flex h-full flex-col overflow-hidden rounded-3xl border border-border/70 p-8 md:p-10"
              >
                <div className="marketing-section-art-layer" aria-hidden>
                  <MarketingSectionArt
                    variant="engagement"
                    className={cn(
                      'absolute h-44 w-56',
                      index === 0 ? '-right-6 top-0' : '-left-4 bottom-0 rotate-180',
                    )}
                  />
                </div>
                <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-primary">{model.eyebrow}</p>
                <h3 className="relative mt-3 text-2xl font-semibold tracking-tight text-foreground md:text-3xl">{model.title}</h3>
                <div className="relative z-10 mt-4 min-w-0 flex-1 space-y-3">
                  {model.body.map((paragraph) => (
                    <p key={paragraph} className="text-sm leading-relaxed text-muted-foreground md:text-base">
                      {paragraph}
                    </p>
                  ))}
                  {model.bestFor ? (
                    <div className="pt-2">
                      <p className="text-sm font-semibold text-foreground">Best for:</p>
                      <ul className="mt-3 space-y-2">
                        {model.bestFor.map((item) => (
                          <li key={item} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                            <BadgeCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
                <div className="relative z-10 mt-auto pt-8">
                  <Button
                    type="button"
                    className="inline-flex h-11 w-fit items-center gap-2 active:translate-y-0"
                    disabled={isNavigating}
                    onClick={() => void navigateToNewQuiz()}
                  >
                    <MarketingNewQuizCtaLabel isNavigating={isNavigating} label={model.ctaLabel} />
                    <ArrowRight className="size-4 shrink-0" aria-hidden />
                  </Button>
                </div>
              </div>
            ))}
          </MarketingSectionReveal>
          <div>
            <MarketingSectionHeader
              reveal
              eyebrow={`WHY ${siteName.toUpperCase()}`}
              title="Clarity. Confidence. Better technology decisions."
            />
            <MarketingSectionReveal className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4" stagger>
              {VALUE_PROPS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.title}
                    className="marketing-card-elevated h-full rounded-2xl border border-border/70 p-6 transition-transform duration-200 motion-safe:hover:-translate-y-0.5"
                  >
                    <Icon className="size-8 text-primary" aria-hidden />
                    <h3 className="mt-4 font-semibold text-foreground">{item.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.body}</p>
                  </div>
                );
              })}
            </MarketingSectionReveal>
          </div>
        </div>
      </MarketingParallaxSection>
      {showTestimonialsSection ? (
        <MarketingParallaxSection
          id={SHOW_HOME_RESOURCES_SECTION ? undefined : MARKETING_CASE_STUDIES_SECTION_ID}
          reveal={false}
          className={cn(
            'marketing-band-dark px-6 py-16 md:py-24',
            !SHOW_HOME_RESOURCES_SECTION && 'scroll-mt-24',
          )}
          speed={0}
        >
          <div className="mx-auto max-w-6xl space-y-10">
            <MarketingSectionHeader
              reveal
              eyebrow="Trusted approach"
              title="Teams come back for clarity they can act on."
              inverted
              align="center"
            />
            <MarketingSectionReveal as="ul" className="grid gap-6 md:grid-cols-3" stagger>
              {testimonials.map((item) => (
                <li
                  key={`${item.name}-${item.quote.slice(0, 32)}`}
                  className="marketing-band-card list-none rounded-2xl p-6 backdrop-blur-sm md:p-8"
                >
                  <Quote className="size-8 text-marketing-band-subtle" aria-hidden />
                  <blockquote className="mt-4 text-pretty text-base leading-relaxed text-marketing-band-fg/90">
                    {item.quote}
                  </blockquote>
                  <footer className="mt-6 border-t border-marketing-band-border pt-4">
                    <p className="font-semibold text-marketing-band-fg">{item.name}</p>
                    {item.role.trim().length > 0 ? (
                      <p className="mt-1 text-sm marketing-band-muted">{item.role}</p>
                    ) : null}
                  </footer>
                </li>
              ))}
            </MarketingSectionReveal>
          </div>
        </MarketingParallaxSection>
      ) : null}
      <MarketingParallaxSection id="about" reveal={false} className="scroll-mt-24 px-6 py-16 md:py-24" speed={0.12}>
        <div className="mx-auto max-w-6xl">
          <div className="grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
            <div className="min-w-0 space-y-6 lg:max-w-2xl">
              <MarketingSectionHeader
                reveal
                eyebrow={`WHY ${siteName.toUpperCase()} EXISTS`}
                title="Better technology decisions start with the right diagnosis."
                description="Most organizations don't struggle because they lack technology. They struggle because they're trying to solve the wrong problem."
              />
              <div className="min-w-0 space-y-4 text-pretty text-muted-foreground">
                <p>
                  Before recommending software, vendors, automation, or implementation strategies, {siteName} helps
                  uncover the root cause of the challenge—so you can invest with confidence and avoid costly mistakes.
                </p>
                <p>Technology decisions should be driven by business needs, not sales presentations.</p>
                <p>
                  Many software projects fail because organizations start with solutions before understanding the
                  problem.
                </p>
                <p>
                  That&apos;s why {siteName} begins with a guided assessment designed to identify your priorities,
                  uncover risks, and recommend the most appropriate path forward.
                </p>
                <p>
                  The goal isn&apos;t another strategy deck — it&apos;s helping you make informed technology decisions
                  that deliver measurable results.
                </p>
              </div>
              <Button
                type="button"
                className="inline-flex h-11 items-center gap-2 active:translate-y-0"
                disabled={isNavigating}
                onClick={() => void navigateToNewQuiz()}
              >
                <MarketingNewQuizCtaLabel isNavigating={isNavigating} label="Start Your Assessment" />
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              </Button>
            </div>
            <MarketingSectionReveal
              direction="right"
              stagger={false}
              className="marketing-card-elevated relative overflow-hidden rounded-3xl border border-border/80 p-8 md:p-10"
            >
              <div className="marketing-section-art-layer" aria-hidden>
                <MarketingSectionArt variant="story" className="absolute -right-6 -top-4 h-52 w-72 md:h-60 md:w-80" />
              </div>
              <div className="relative flex items-start gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <Compass className="size-6" aria-hidden />
                </span>
                <div>
                  <h3 className="text-xl font-semibold text-foreground">Why start with a diagnostic assessment?</h3>
                  <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground md:text-base">
                    <p>
                      Technology challenges often look similar on the surface but require very different solutions.
                    </p>
                    <p>A reporting issue might be a process problem.</p>
                    <p>An automation initiative might require process redesign first.</p>
                    <p>
                      A software implementation delay might stem from unclear requirements or governance gaps.
                    </p>
                    <p>
                      The assessment helps identify the real issue before time and money are invested in the wrong
                      solution.
                    </p>
                  </div>
                </div>
              </div>
              <div className="relative mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-border/70 bg-muted/40 p-4 dark:bg-muted/20">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Mission</p>
                  <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                    <p>Help organizations make smarter technology decisions.</p>
                    <p>
                      Provide independent, practical guidance that reduces risk, improves outcomes, and maximizes the
                      value of technology investments.
                    </p>
                  </div>
                </div>
                <div className="rounded-xl border border-border/70 bg-muted/40 p-4 dark:bg-muted/20">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">Approach</p>
                  <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                    <p className="font-semibold text-foreground">Diagnose first. Recommend second.</p>
                    <p>
                      Every recommendation starts with understanding the problem, evaluating the options, and identifying
                      the path most likely to succeed.
                    </p>
                  </div>
                </div>
              </div>
            </MarketingSectionReveal>
          </div>
        </div>
      </MarketingParallaxSection>
      {SHOW_HOME_RESOURCES_SECTION ? (
      <MarketingParallaxSection
        id="case-studies"
        reveal={false}
        className="scroll-mt-24 px-6 py-20 md:py-28"
        speed={-0.09}
      >
        <div className="mx-auto max-w-6xl space-y-16">
          <MarketingSectionHeader
            reveal
            eyebrow="Resources"
            title="Practical references for technology decisions."
            description="Guides, checklists, and playbooks you can forward to finance, ops, or IT — written for growing teams making vendor, delivery, and automation calls."
          />
          <div className="marketing-band-dark relative overflow-hidden rounded-3xl px-8 py-12 shadow-lg md:px-14 md:py-16">
            <div
              className="pointer-events-none absolute inset-0 opacity-40 marketing-service-panel-glow"
              aria-hidden
            />
            <div className="marketing-section-art-layer" aria-hidden>
              <MarketingSectionArt variant="resources" className="absolute -right-4 top-2 h-48 w-64 md:h-56 md:w-72" />
            </div>
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
                className="inline-flex h-11 w-full shrink-0 items-center gap-2 shadow-md active:translate-y-0 md:w-auto"
                disabled={isNavigating}
                onClick={() => void navigateToNewQuiz()}
              >
                <MarketingNewQuizCtaLabel isNavigating={isNavigating} />
                <ArrowRight className="size-4 shrink-0" aria-hidden />
              </Button>
            </div>
          </div>
          <div className="grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
            <MarketingSectionReveal
              direction="left"
              stagger={false}
              className="marketing-card-elevated relative overflow-hidden rounded-3xl border border-border/80 p-8 md:p-10"
            >
              <div
                className="marketing-section-art-layer pointer-events-none absolute -right-4 bottom-0 hidden h-40 w-56 sm:block"
                aria-hidden
              >
                <MarketingSectionArt variant="resources" />
              </div>
              <p className="relative text-xs font-semibold uppercase tracking-[0.2em] text-primary">Before your session</p>
              <h3 className="relative mt-3 text-2xl font-semibold tracking-tight text-foreground">Come prepared, leave with decisions.</h3>
              <p className="relative mt-4 text-sm leading-relaxed text-muted-foreground md:text-base">
                Focused calls work best when the room shares context. These three beats are enough — you do not need a
                full requirements document.
              </p>
              <ol className="relative mt-8 list-none space-y-6 p-0">
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
            </MarketingSectionReveal>
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
              reveal
              eyebrow="Library"
              title="References you can share internally"
              description="Each piece is vendor-neutral and written for operators — use them in steering committees, vendor reviews, or pre-reads before booking."
            />
            <MarketingSectionReveal className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" stagger>
              {RESOURCE_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <div
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
                  </div>
                );
              })}
            </MarketingSectionReveal>
          </div>
        </div>
      </MarketingParallaxSection>
      ) : null}
    </main>
  );
}
