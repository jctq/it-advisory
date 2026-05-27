import type { ReactElement, ReactNode } from 'react';
import {
  MarketingSectionReveal,
  MarketingSectionRevealItem,
} from '@/components/marketing/marketing-section-reveal';
import { cn } from '@/lib/utils';

export type MarketingSectionHeaderProps = {
  readonly eyebrow: string;
  readonly title: string;
  readonly description?: string;
  readonly align?: 'left' | 'center';
  readonly inverted?: boolean;
  readonly className?: string;
  readonly action?: ReactNode;
  readonly reveal?: boolean;
};

/**
 * Resonance-style section intro: small uppercase eyebrow + display heading.
 */
export function MarketingSectionHeader(props: MarketingSectionHeaderProps): ReactElement {
  const align = props.align ?? 'left';
  const reveal = props.reveal ?? false;
  const rootClassName = cn(
    'flex flex-col gap-4',
    align === 'center' && 'items-center text-center',
    props.className,
  );
  const titleClassName = cn(
    'text-balance text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl lg:leading-[1.08]',
    props.inverted ? 'text-marketing-band-fg' : 'text-foreground',
  );
  const descriptionClassName = cn(
    'max-w-2xl text-pretty text-base leading-relaxed md:text-lg',
    props.inverted ? 'marketing-band-muted' : 'text-muted-foreground',
    align === 'center' && 'mx-auto',
  );
  const titleBlock = (
    <div
      className={cn(
        'flex w-full flex-col gap-4',
        align === 'center' ? 'items-center' : 'md:flex-row md:items-end md:justify-between',
      )}
    >
      <div className={cn('space-y-3', align === 'center' && 'max-w-3xl')}>
        <h2 className={titleClassName}>{props.title}</h2>
        {props.description !== undefined ? <p className={descriptionClassName}>{props.description}</p> : null}
      </div>
      {props.action !== undefined ? <div className="shrink-0">{props.action}</div> : null}
    </div>
  );
  if (!reveal) {
    return (
      <div className={rootClassName}>
        <p className="marketing-section-eyebrow">{props.eyebrow}</p>
        {titleBlock}
      </div>
    );
  }
  return (
    <MarketingSectionReveal className={rootClassName} stagger>
      <MarketingSectionRevealItem>
        <p className="marketing-section-eyebrow">{props.eyebrow}</p>
      </MarketingSectionRevealItem>
      <MarketingSectionRevealItem>{titleBlock}</MarketingSectionRevealItem>
    </MarketingSectionReveal>
  );
}
