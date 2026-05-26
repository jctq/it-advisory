import type { ReactElement } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function AccountDiagnosticsLoading(): ReactElement {
  return (
    <main className="mx-auto max-w-6xl px-0 py-0 md:px-6 md:py-12">
      <div className="mb-8 hidden flex-wrap items-start justify-between gap-4 md:flex">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Account</p>
          <Skeleton className="h-9 w-56" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
      </div>
      <Card className="gap-0 border-0 bg-transparent py-0 shadow-none md:gap-6 md:border md:border-border/80 md:bg-card md:py-6 md:shadow-sm">
        <CardContent className="flex flex-col items-center justify-center px-4 py-20 md:px-6 md:py-16">
          <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
          <p className="mt-6 text-sm font-medium text-foreground">Loading diagnostics…</p>
          <p className="mt-2 text-sm text-muted-foreground">Fetching your saved sessions.</p>
        </CardContent>
      </Card>
    </main>
  );
}
