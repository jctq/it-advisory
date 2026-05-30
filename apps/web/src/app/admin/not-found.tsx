import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Page not found — TeqMD Admin',
};

export default function AdminNotFoundPage(): ReactElement {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">404</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">Page not found</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground" role="status">
        This admin URL does not exist or you may not have access. Return to the dashboard or sign in again.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button asChild className="min-h-10">
          <Link href="/admin">Admin dashboard</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-10">
          <Link href="/admin/login">Sign in</Link>
        </Button>
      </div>
    </div>
  );
}
