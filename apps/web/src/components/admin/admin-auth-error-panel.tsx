import Image from 'next/image';
import Link from 'next/link';
import { AlertCircle, ArrowLeft, ShieldAlert } from 'lucide-react';
import type { AdminAuthErrorPresentation } from '@/lib/admin/resolve-admin-auth-error';
import {
  BRAND_LOGO_COMPACT_DARK,
  BRAND_LOGO_COMPACT_LIGHT,
  brandAssetUrl,
} from '@/lib/brand/brand-assets';
import { Button } from '@/components/ui/button';

type AdminAuthErrorPanelProps = {
  readonly presentation: AdminAuthErrorPresentation;
  readonly errorCode: string | null;
};

export function AdminAuthErrorPanel(props: AdminAuthErrorPanelProps): React.ReactElement {
  const isAccessDenied = props.errorCode === 'AccessDenied';
  const Icon = isAccessDenied ? ShieldAlert : AlertCircle;
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <Link href="/admin/login" className="rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          <Image
            src={brandAssetUrl(BRAND_LOGO_COMPACT_LIGHT)}
            alt="TeqMD"
            width={140}
            height={40}
            className="h-9 w-auto dark:hidden"
            priority
          />
          <Image
            src={brandAssetUrl(BRAND_LOGO_COMPACT_DARK)}
            alt="TeqMD"
            width={140}
            height={40}
            className="hidden h-9 w-auto dark:block"
            priority
          />
        </Link>
        <div
          className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive"
          aria-hidden
        >
          <Icon className="size-7" />
        </div>
        <header className="space-y-3" role="alert">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">{props.presentation.title}</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">{props.presentation.message}</p>
        </header>
      </div>
      <div className="flex flex-col gap-3">
        <Button asChild className="w-full">
          <Link href="/admin/login">Back to sign in</Link>
        </Button>
        <Button asChild variant="outline" className="w-full">
          <Link href="/">
            <ArrowLeft className="size-4" aria-hidden />
            Return to website
          </Link>
        </Button>
      </div>
    </main>
  );
}
