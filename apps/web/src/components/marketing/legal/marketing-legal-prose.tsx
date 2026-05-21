import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type MarketingLegalProseProps = {
  readonly children: ReactNode;
  readonly className?: string;
};

/**
 * Shared typography wrapper for privacy policy and terms content.
 */
export function MarketingLegalProse(props: MarketingLegalProseProps): ReactElement {
  return (
    <div
      className={cn(
        'space-y-6 text-sm leading-relaxed text-muted-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:tracking-tight [&_li]:ml-4 [&_li]:list-disc [&_ol]:list-decimal [&_ol]:space-y-2 [&_ol]:pl-4 [&_p+p]:mt-0 [&_ul]:space-y-2',
        props.className,
      )}
    >
      {props.children}
    </div>
  );
}
