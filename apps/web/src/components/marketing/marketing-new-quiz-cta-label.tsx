import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

const DEFAULT_LABEL = 'Start My Assessment';
const LOADING_LABEL = 'Starting…';

export type MarketingNewQuizCtaLabelProps = {
  readonly isNavigating: boolean;
  readonly label?: string;
  readonly className?: string;
};

/**
 * Keeps CTA width stable while switching to the loading label (avoids header/layout shift).
 */
export function MarketingNewQuizCtaLabel(props: MarketingNewQuizCtaLabelProps): ReactElement {
  const label = props.label ?? DEFAULT_LABEL;
  if (!props.isNavigating) {
    return <span className={props.className}>{label}</span>;
  }
  return (
    <span className={cn('relative inline-block leading-none', props.className)}>
      <span className="invisible" aria-hidden>
        {label}
      </span>
      <span className="absolute inset-0 flex items-center justify-center">{LOADING_LABEL}</span>
    </span>
  );
}
