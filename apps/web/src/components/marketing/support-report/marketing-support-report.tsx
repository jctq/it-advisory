'use client';

import type { ReactElement, ReactNode } from 'react';
import { SupportReportDialog } from '@/components/marketing/support-report/support-report-dialog';
import { SupportReportFab } from '@/components/marketing/support-report/support-report-fab';
import { SupportReportProvider, useSupportReport } from '@/components/marketing/support-report/support-report-context';

type MarketingSupportReportProps = {
  readonly children: ReactNode;
};

function MarketingSupportReportCaptureRoot(props: MarketingSupportReportProps): ReactElement {
  const { captureRootRef } = useSupportReport();
  return (
    <div ref={captureRootRef} className="flex min-h-dvh flex-col">
      {props.children}
    </div>
  );
}

/**
 * Wraps the marketing layout with report capture, FAB, and submit dialog.
 */
export function MarketingSupportReport(props: MarketingSupportReportProps): ReactElement {
  return (
    <SupportReportProvider>
      <MarketingSupportReportCaptureRoot>{props.children}</MarketingSupportReportCaptureRoot>
      <SupportReportFab />
      <SupportReportDialog />
    </SupportReportProvider>
  );
}
