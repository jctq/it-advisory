import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type MarketingSectionHeaderProps = {
  readonly eyebrow: string;
  readonly title: string;
  readonly description?: string;
  readonly align?: 'left' | 'center';
  readonly inverted?: boolean;
  readonly className?: string;
  readonly action?: ReactNode;
};

/**
 * Resonance-style section intro: small uppercase eyebrow + display heading.
 */
export function MarketingSectionHeader(props: MarketingSectionHeaderProps): ReactElement {
  const align = props.align ?? 'left';
  return (
    <div
      className={cn(
        'flex flex-col gap-4',
        align === 'center' && 'items-center text-center',
        props.className,
      )}
    >
      <p className="marketing-section-eyebrow">{props.eyebrow}</p>
      <div
        className={cn(
          'flex w-full flex-col gap-4',
          align === 'center' ? 'items-center' : 'md:flex-row md:items-end md:justify-between',
        )}
      >
        <div className={cn('space-y-3', align === 'center' && 'max-w-3xl')}>
          <h2
            className={cn(
              'text-balance text-3xl font-semibold tracking-tight md:text-4xl lg:text-5xl lg:leading-[1.08]',
              props.inverted ? 'text-marketing-band-fg' : 'text-foreground',
            )}
          >
            {props.title}
          </h2>
          {props.description !== undefined ? (
            <p
              className={cn(
                'max-w-2xl text-pretty text-base leading-relaxed md:text-lg',
                props.inverted ? 'marketing-band-muted' : 'text-muted-foreground',
                align === 'center' && 'mx-auto',
              )}
            >
              {props.description}
            </p>
          ) : null}
        </div>
        {props.action !== undefined ? <div className="shrink-0">{props.action}</div> : null}
      </div>
    </div>
  );
}
