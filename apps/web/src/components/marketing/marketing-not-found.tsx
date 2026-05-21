import { ArrowLeft, BookOpen, Compass, Home, Stethoscope } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

type QuickLink = {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly icon: ReactElement;
};

const QUICK_LINKS: readonly QuickLink[] = [
  {
    href: '/',
    label: 'Home',
    description: 'Return to the main site and overview.',
    icon: <Home className="size-5" aria-hidden />,
  },
  {
    href: '/diagnostic',
    label: 'Guided diagnostic',
    description: 'Start or continue your technology assessment.',
    icon: <Stethoscope className="size-5" aria-hidden />,
  },
  {
    href: '/blog',
    label: 'Blog',
    description: 'Read practical guides on diagnostics and delivery.',
    icon: <BookOpen className="size-5" aria-hidden />,
  },
] as const;

/**
 * Branded 404 content for marketing routes — header/footer come from the marketing layout.
 */
export function MarketingNotFound(): ReactElement {
  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 marketing-hero-base-wash" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 opacity-80 dark:opacity-100"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 55% 45% at 50% 0%, var(--marketing-hero-glow-strong), transparent 70%)',
        }}
        aria-hidden
      />
      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-16 sm:px-6 md:py-24 lg:py-28">
        <div className="mx-auto w-full max-w-2xl text-center">
          <p className="marketing-section-eyebrow" id="not-found-eyebrow">
            Page not found
          </p>
          <p
            className="mt-6 text-[clamp(5rem,22vw,9rem)] font-semibold leading-none tracking-tighter text-primary/20 select-none"
            aria-hidden
          >
            404
          </p>
          <div
            className="mx-auto mt-2 flex size-14 items-center justify-center rounded-2xl border border-border bg-card/80 shadow-sm backdrop-blur-sm"
            aria-hidden
          >
            <Compass className="size-7 text-primary" />
          </div>
          <h1 className="mt-6 text-balance text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
            This page doesn&apos;t exist
          </h1>
          <p
            className="mx-auto mt-4 max-w-md text-pretty text-base leading-relaxed text-muted-foreground"
            role="status"
            aria-labelledby="not-found-eyebrow"
          >
            The link may be outdated, mistyped, or the page was moved. Choose a destination below or head back to
            home.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="min-h-11 w-full min-w-44 sm:w-auto">
              <Link href="/">
                <Home className="size-4" aria-hidden />
                Back to home
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="min-h-11 w-full min-w-44 sm:w-auto">
              <Link href="/blog">
                <BookOpen className="size-4" aria-hidden />
                Browse blog
              </Link>
            </Button>
          </div>
        </div>
        <section
          className="mx-auto mt-14 w-full max-w-xl"
          aria-labelledby="not-found-quick-links-heading"
        >
          <h2 id="not-found-quick-links-heading" className="sr-only">
            Helpful links
          </h2>
          <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card/90 shadow-sm backdrop-blur-sm">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className={cn(
                    'group flex min-h-18 items-start gap-4 px-5 py-4 transition-colors',
                    'hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:ring-inset',
                  )}
                >
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                    {link.icon}
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-medium text-foreground">{link.label}</span>
                    <span className="mt-0.5 block text-sm leading-relaxed text-muted-foreground">
                      {link.description}
                    </span>
                  </span>
                  <ArrowLeft
                    className="mt-2 size-4 shrink-0 rotate-180 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 motion-reduce:opacity-100"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}
