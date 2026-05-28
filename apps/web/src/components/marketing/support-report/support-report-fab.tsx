'use client';

import { Flag } from 'lucide-react';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { useSupportReport } from '@/components/marketing/support-report/support-report-context';

export function SupportReportFab(): ReactElement {
  const { openReportDialog } = useSupportReport();
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-40 print:hidden">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        className="pointer-events-auto shadow-md"
        onClick={openReportDialog}
        aria-label="Report an issue"
      >
        <Flag className="size-4" aria-hidden />
        Report
      </Button>
    </div>
  );
}
