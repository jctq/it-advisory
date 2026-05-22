'use client';

import { Loader2, Package } from 'lucide-react';
import { useEffect, useState, type ReactElement } from 'react';
import type { PublicCatalogServiceRow } from '@/lib/data/public-catalog-services';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { cn } from '@/lib/utils';

const CATALOG_SERVICE_API_URL = buildApiUrl('/api/catalog/services');

type BookingConfirmedServiceCardProps = {
  readonly serviceKey: string;
  /** When provided by the parent, skips an internal catalog fetch (avoids duplicate requests). */
  readonly service?: PublicCatalogServiceRow | null;
  readonly amountLabelOverride?: string | null;
  readonly className?: string;
};

export function BookingConfirmedServiceCard(props: BookingConfirmedServiceCardProps): ReactElement {
  const { serviceKey, service: serviceFromParent, amountLabelOverride, className } = props;
  const isControlled = serviceFromParent !== undefined;
  const trimmedServiceKey = serviceKey.trim();
  const isEmptyServiceKey = trimmedServiceKey.length === 0;
  const [fetchedService, setFetchedService] = useState<PublicCatalogServiceRow | null>(null);
  const [fetchStatus, setFetchStatus] = useState<'loading' | 'ready' | 'unavailable'>('loading');
  const service = isControlled ? (serviceFromParent ?? null) : fetchedService;
  const status = isControlled
    ? serviceFromParent !== null
      ? 'ready'
      : 'unavailable'
    : isEmptyServiceKey
      ? 'unavailable'
      : fetchStatus;
  useEffect(() => {
    if (isControlled || isEmptyServiceKey) {
      return;
    }
    const controller = new AbortController();
    void fetch(`${CATALOG_SERVICE_API_URL}?serviceKey=${encodeURIComponent(trimmedServiceKey)}`, {
      signal: controller.signal,
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = (await response.json()) as { service?: PublicCatalogServiceRow | null; error?: string };
        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to load service');
        }
        setFetchedService(payload.service ?? null);
        setFetchStatus(payload.service !== null ? 'ready' : 'unavailable');
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setFetchedService(null);
          setFetchStatus('unavailable');
        }
      });
    return () => {
      controller.abort();
    };
  }, [isControlled, isEmptyServiceKey, trimmedServiceKey]);
  if (status === 'loading') {
    return (
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground',
          className,
        )}
      >
        <Loader2 className="size-4 animate-spin" aria-hidden />
        Loading service details…
      </div>
    );
  }
  if (status === 'unavailable' || service === null) {
    return (
      <div className={cn('rounded-xl border border-border bg-muted/20 px-4 py-3 text-sm text-muted-foreground', className)}>
        <p className="font-medium text-foreground">Consultation session</p>
        {amountLabelOverride !== null && amountLabelOverride !== undefined && amountLabelOverride.length > 0 ? (
          <p className="mt-1 tabular-nums">{amountLabelOverride}</p>
        ) : null}
      </div>
    );
  }
  const displayAmount =
    amountLabelOverride !== null && amountLabelOverride !== undefined && amountLabelOverride.length > 0
      ? amountLabelOverride
      : service.amountLabel;
  return (
    <div className={cn('rounded-xl border border-primary/15 bg-primary/5 px-4 py-4 md:px-5 md:py-5', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">Your service</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{service.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{service.durationLabel}</p>
        </div>
        <p className="text-xl font-semibold tracking-tight text-foreground tabular-nums">{displayAmount}</p>
      </div>
      {service.description.trim().length > 0 ? (
        <p className="mt-3 text-sm leading-relaxed text-foreground/90">{service.description}</p>
      ) : null}
      {service.kind === 'package' && service.sessionsIncluded !== null ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Package className="size-3.5" aria-hidden />
          {service.sessionsIncluded} sessions included in this package
        </p>
      ) : null}
    </div>
  );
}
