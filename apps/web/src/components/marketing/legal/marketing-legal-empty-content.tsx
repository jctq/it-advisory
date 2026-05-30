import type { ReactElement } from 'react';
import { MarketingLegalProse } from '@/components/marketing/legal/marketing-legal-prose';

/**
 * Placeholder when no CMS blog post is configured for a legal document.
 */
export function MarketingLegalEmptyContent(): ReactElement {
  return (
    <MarketingLegalProse>
      <p className="text-sm text-muted-foreground">No content available.</p>
    </MarketingLegalProse>
  );
}
