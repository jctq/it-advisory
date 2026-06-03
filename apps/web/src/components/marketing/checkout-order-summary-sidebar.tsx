'use client';

import { CheckCircle2, Lock, Tag, X } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import type { PaymentConfigPublic } from '@teqmd/api-client/marketing-payment-api-client';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type CheckoutSlotLabels = {
  readonly dateLabel: string;
  readonly timeLabel: string;
  readonly timezoneLabel: string;
};

type CheckoutOrderSummarySidebarProps = {
  readonly serviceTitle: string;
  readonly serviceDescription: string;
  readonly serviceDuration: string;
  readonly paymentConfig: PaymentConfigPublic | null;
  readonly checkoutAmountLabel: string;
  readonly slotLabels: CheckoutSlotLabels | null;
  readonly payBeforeLabels: CheckoutSlotLabels | null;
  readonly promoCode: string;
  readonly promoError: string | null;
  readonly recordingOptIn: boolean;
  readonly isPaymentHoldBlocked: boolean;
  readonly onPromoCodeChange: (value: string) => void;
  readonly onRecordingOptInChange: (checked: boolean) => void;
  readonly actions: ReactNode;
};

function CheckoutLineItem(props: {
  readonly label: string;
  readonly value: string;
  readonly valueClassName?: string;
  readonly hint?: string;
}): ReactElement {
  return (
    <div className="flex items-start justify-between gap-4 text-sm">
      <div className="min-w-0">
        <span className="text-muted-foreground">{props.label}</span>
        {props.hint !== undefined ? (
          <span className="mt-0.5 block text-xs text-muted-foreground/80">{props.hint}</span>
        ) : null}
      </div>
      <span className={cn('shrink-0 tabular-nums font-medium text-foreground', props.valueClassName)}>
        {props.value}
      </span>
    </div>
  );
}

export function CheckoutOrderSummarySidebar(props: CheckoutOrderSummarySidebarProps): ReactElement {
  const {
    serviceTitle,
    serviceDescription,
    serviceDuration,
    paymentConfig,
    checkoutAmountLabel,
    slotLabels,
    payBeforeLabels,
    promoCode,
    promoError,
    recordingOptIn,
    isPaymentHoldBlocked,
    onPromoCodeChange,
    onRecordingOptInChange,
    actions,
  } = props;
  const hasAppliedPromo =
    paymentConfig?.appliedPromoCode !== undefined &&
    paymentConfig.appliedPromoCode.length > 0 &&
    (paymentConfig.discountCentavos ?? 0) > 0;
  const hasRecordingSurcharge =
    recordingOptIn &&
    paymentConfig !== null &&
    (paymentConfig.recordingSurchargeCentavos ?? 0) > 0;
  const subtotalLabel = paymentConfig?.subtotalAmountLabel ?? checkoutAmountLabel;
  return (
    <aside className="space-y-4 lg:sticky lg:top-44 lg:z-30">
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xs">
        <div className="border-b border-border/80 bg-muted/20 px-5 py-3.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Order summary</p>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div>
            <p className="text-sm font-semibold text-foreground">{serviceTitle}</p>
            {serviceDescription.length > 0 ? (
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{serviceDescription}</p>
            ) : null}
          </div>
          {payBeforeLabels !== null ? (
            <div className="rounded-xl border border-border/70 bg-muted/15 px-3.5 py-3">
              <p className="text-xs font-medium text-muted-foreground">Pay on or before</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{payBeforeLabels.dateLabel}</p>
              <p className="tabular-nums text-sm font-semibold text-foreground">{payBeforeLabels.timeLabel}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{payBeforeLabels.timezoneLabel}</p>
            </div>
          ) : null}
          {slotLabels !== null ? (
            <div className="rounded-xl border border-border/70 bg-muted/15 px-3.5 py-3">
              <p className="text-xs font-medium text-muted-foreground">Date &amp; time</p>
              <p className="mt-1 text-sm font-semibold text-foreground">{slotLabels.dateLabel}</p>
              <p className="tabular-nums text-sm font-semibold text-foreground">{slotLabels.timeLabel}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{slotLabels.timezoneLabel}</p>
            </div>
          ) : null}
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Duration</span>
            <span className="font-medium text-foreground">{serviceDuration}</span>
          </div>
          <div className="space-y-2.5 border-t border-border/80 pt-4">
            <CheckoutLineItem label="Subtotal" value={subtotalLabel} />
            {hasAppliedPromo ? (
              <CheckoutLineItem
                label={`Discount (${paymentConfig!.appliedPromoCode})`}
                value={`−${paymentConfig!.discountLabel}`}
                valueClassName="font-semibold text-emerald-600 dark:text-emerald-400"
              />
            ) : null}
            {hasRecordingSurcharge ? (
              <CheckoutLineItem
                label="AI meeting notes"
                value={`+${paymentConfig!.recordingSurchargeLabel}`}
              />
            ) : null}
            <div className="flex items-center justify-between gap-4 border-t border-border/80 pt-3">
              <span className="text-sm font-semibold text-foreground">Total</span>
              <span className="text-base font-bold tabular-nums text-foreground">{checkoutAmountLabel}</span>
            </div>
            <p className="text-xs text-muted-foreground">Inclusive of VAT</p>
          </div>
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 shadow-xs">
        <label htmlFor="checkout-promo-code" className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Tag className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          Promo code
        </label>
        <p className="mt-1 text-xs text-muted-foreground">Optional — applied to your subtotal before add-ons.</p>
        <div className="mt-3 flex gap-2">
          <Input
            id="checkout-promo-code"
            value={promoCode}
            onChange={(event) => onPromoCodeChange(event.target.value)}
            placeholder="Enter code"
            autoComplete="off"
            disabled={isPaymentHoldBlocked}
            aria-invalid={promoError !== null}
            aria-describedby={
              promoError !== null
                ? 'checkout-promo-error'
                : hasAppliedPromo
                  ? 'checkout-promo-applied'
                  : undefined
            }
            className="h-11 min-h-11 touch-manipulation rounded-xl border-border/90 text-base shadow-none sm:text-sm"
          />
          {promoCode.trim().length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-11 shrink-0 rounded-xl"
              disabled={isPaymentHoldBlocked}
              aria-label="Clear promo code"
              onClick={() => onPromoCodeChange('')}
            >
              <X className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
        {promoError !== null ? (
          <p id="checkout-promo-error" className="mt-2 text-xs text-destructive" role="alert">
            {promoError}
          </p>
        ) : null}
        {hasAppliedPromo && promoError === null ? (
          <p
            id="checkout-promo-applied"
            className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"
            role="status"
          >
            <CheckCircle2 className="size-3.5 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">{paymentConfig!.appliedPromoCode}</span> applied — you save{' '}
              {paymentConfig!.discountLabel}
            </span>
          </p>
        ) : null}
      </div>
      {paymentConfig?.recordingsEnabled === true ? (
        <label
          className={cn(
            'grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 rounded-2xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-primary/25',
            isPaymentHoldBlocked && 'pointer-events-none opacity-60',
          )}
        >
          <Checkbox
            checked={recordingOptIn}
            className="row-start-1 self-center"
            disabled={isPaymentHoldBlocked}
            onCheckedChange={(checked) => onRecordingOptInChange(checked === true)}
          />
          <span className="row-start-1 min-w-0 text-sm font-medium leading-snug text-foreground">
            AI meeting notes &amp; recording
            {paymentConfig.recordingOptInPriceCentavos > 0
              ? ` (+${paymentConfig.recordingOptInPriceLabel})`
              : ' (included)'}
          </span>
          <span
            className="col-start-2 row-start-2 text-xs leading-relaxed text-muted-foreground"
            title="A visible Fathom notetaker may join your video call to capture notes and a summary. By opting in, you consent to recording and transcription for this consultation."
          >
            Fathom may join your call. Opt-in = recording consent.
          </span>
        </label>
      ) : null}
      <div className="hidden gap-3 rounded-2xl border border-primary/15 bg-primary/5 px-4 py-3 lg:flex">
        <Lock className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-foreground">Secure checkout</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Your payment is safe and encrypted. We never store your card details on this site.
          </p>
        </div>
      </div>
      {actions}
    </aside>
  );
}
