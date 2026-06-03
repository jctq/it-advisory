'use client';

import type { ReactElement } from 'react';
import { Lock, Loader2, Shield } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function PaymentProcessingDialog(props: { readonly open: boolean }): ReactElement {
  return (
    <Dialog open={props.open}>
      <DialogContent
        className="gap-0 sm:max-w-md"
        showCloseButton={false}
        onPointerDownOutside={(event) => {
          event.preventDefault();
        }}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
        }}
      >
        <DialogHeader className="space-y-2 text-center sm:text-left">
          <DialogTitle>Redirecting to secure payment</DialogTitle>
          <DialogDescription>Please wait while we open your payment provider.</DialogDescription>
        </DialogHeader>
        <div className="mt-6 flex flex-col items-center rounded-2xl border border-border bg-primary/5 px-6 py-10">
          <div className="flex size-24 items-center justify-center rounded-full bg-primary/10">
            <Lock className="size-11 text-primary" aria-hidden />
          </div>
          <Loader2 className="mt-6 size-8 animate-spin text-primary" aria-hidden />
          <p className="mt-5 text-center text-sm font-semibold text-foreground">Opening secure checkout…</p>
          <p className="mt-2 text-center text-sm text-muted-foreground">This will only take a few seconds.</p>
        </div>
        <div className="mt-5 flex gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm text-foreground">
          <Shield className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <p>
            <span className="font-semibold">Do not close this window or refresh the page.</span>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
