'use client';

import { CircleDollarSign, PencilLine, Plus, RotateCcw, Trash2 } from 'lucide-react';
import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type Ref,
} from 'react';
import type {
  CatalogServiceEntry,
  CatalogServiceKind,
  PromoCodeEntry,
} from '@/domain/monetization-types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { normalizePromoCode, normalizeServiceKey } from '@/lib/monetization/catalog-key-utils';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';

const PRICING_SETTINGS_API_URL: string = buildApiUrl('/api/admin/monetization-settings');

type SettingsPayload = {
  readonly services: readonly CatalogServiceEntry[];
  readonly promoCodes: readonly PromoCodeEntry[];
};

type PricingCatalogTab = 'catalog' | 'packages' | 'promos';

type CatalogDialogMode = 'create' | 'edit';

type CatalogDialogDraft = {
  readonly serviceKey: string;
  readonly title: string;
  readonly description: string;
  readonly durationLabel: string;
  readonly amountPesos: string;
  readonly sortOrder: string;
  readonly sessionsIncluded: string;
  readonly enabled: boolean;
};

type PromoDialogDraft = {
  readonly code: string;
  readonly discountType: PromoCodeEntry['discountType'];
  readonly discountValue: string;
  readonly applicableServiceKeys: string;
  readonly maxRedemptions: string;
  readonly validFrom: string;
  readonly validUntil: string;
  readonly enabled: boolean;
};

export type AdminPricingSettingsFormState = {
  readonly isDirty: boolean;
  readonly isSaving: boolean;
  readonly isLoading: boolean;
};

export type AdminPricingSettingsFormHandle = {
  readonly save: () => Promise<void>;
  readonly reset: () => void;
};

type AdminPricingSettingsFormProps = {
  readonly formRef?: Ref<AdminPricingSettingsFormHandle>;
  readonly onStateChange?: (state: AdminPricingSettingsFormState) => void;
};

function serializeSettings(settings: SettingsPayload): string {
  return JSON.stringify(settings);
}

function centavosToPesos(amountCentavos: number): string {
  return (amountCentavos / 100).toFixed(2);
}

function pesosToCentavos(pesos: string): number {
  const parsed = Number.parseFloat(pesos);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function formatPromoDate(iso: Date | string | null | undefined): string {
  if (iso === null || iso === undefined) {
    return '';
  }
  const date = iso instanceof Date ? iso : new Date(iso);
  if (!Number.isFinite(date.getTime())) {
    return '';
  }
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function isDeletedAtSet(deletedAt: Date | string | null | undefined): boolean {
  return deletedAt !== null && deletedAt !== undefined;
}

function resolveEntryStatus(entry: { readonly enabled: boolean; readonly deletedAt?: Date | string | null }): {
  readonly label: string;
  readonly variant: 'default' | 'secondary' | 'destructive' | 'outline';
} {
  if (isDeletedAtSet(entry.deletedAt)) {
    return { label: 'Deleted', variant: 'destructive' };
  }
  if (!entry.enabled) {
    return { label: 'Disabled', variant: 'secondary' };
  }
  return { label: 'Active', variant: 'default' };
}

function truncateDescriptionPreview(description: string, maxLength: number = 72): string {
  const trimmed = description.trim();
  if (trimmed.length === 0) {
    return '—';
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength)}…`;
}

function emptyCatalogDraft(kind: CatalogServiceKind): CatalogDialogDraft {
  return {
    serviceKey: '',
    title: '',
    description: '',
    durationLabel: kind === 'package' ? '3 checkpoints' : '60 minutes',
    amountPesos: kind === 'package' ? '15000.00' : '5000.00',
    sortOrder: '0',
    sessionsIncluded: '3',
    enabled: true,
  };
}

function catalogDraftFromEntry(entry: CatalogServiceEntry): CatalogDialogDraft {
  return {
    serviceKey: entry.serviceKey,
    title: entry.title,
    description: entry.description,
    durationLabel: entry.durationLabel,
    amountPesos: centavosToPesos(entry.amountCentavos),
    sortOrder: String(entry.sortOrder),
    sessionsIncluded: String(entry.sessionsIncluded ?? 3),
    enabled: entry.enabled,
  };
}

function emptyPromoDraft(): PromoDialogDraft {
  return {
    code: '',
    discountType: 'percent',
    discountValue: '10',
    applicableServiceKeys: '',
    maxRedemptions: '0',
    validFrom: '',
    validUntil: '',
    enabled: true,
  };
}

function promoDraftFromEntry(entry: PromoCodeEntry): PromoDialogDraft {
  return {
    code: entry.code,
    discountType: entry.discountType,
    discountValue: String(entry.discountValue),
    applicableServiceKeys: (entry.applicableServiceKeys ?? []).join(', '),
    maxRedemptions: String(entry.maxRedemptions),
    validFrom: formatPromoDate(entry.validFrom),
    validUntil: formatPromoDate(entry.validUntil),
    enabled: entry.enabled,
  };
}

export function AdminPricingSettingsForm(props: AdminPricingSettingsFormProps): ReactElement {
  const [settings, setSettings] = useState<SettingsPayload | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [pricingTab, setPricingTab] = useState<PricingCatalogTab>('catalog');
  const [showDeleted, setShowDeleted] = useState(false);
  const [catalogDialogOpen, setCatalogDialogOpen] = useState(false);
  const [catalogDialogMode, setCatalogDialogMode] = useState<CatalogDialogMode>('create');
  const [catalogDialogKind, setCatalogDialogKind] = useState<CatalogServiceKind>('session');
  const [catalogEditIndex, setCatalogEditIndex] = useState<number | null>(null);
  const [catalogDraft, setCatalogDraft] = useState<CatalogDialogDraft>(emptyCatalogDraft('session'));
  const [promoDialogOpen, setPromoDialogOpen] = useState(false);
  const [promoDialogMode, setPromoDialogMode] = useState<CatalogDialogMode>('create');
  const [promoEditIndex, setPromoEditIndex] = useState<number | null>(null);
  const [promoDraft, setPromoDraft] = useState<PromoDialogDraft>(emptyPromoDraft());
  const [deleteTarget, setDeleteTarget] = useState<
    | { readonly type: 'service'; readonly index: number }
    | { readonly type: 'promo'; readonly index: number }
    | null
  >(null);
  const onStateChangeRef = useRef(props.onStateChange);
  useEffect(() => {
    onStateChangeRef.current = props.onStateChange;
  }, [props.onStateChange]);
  const isDirty = settings !== null && serializeSettings(settings) !== savedSnapshot;
  useEffect(() => {
    let cancelled = false;
    void fetch(PRICING_SETTINGS_API_URL, { cache: 'no-store' })
      .then(async (response) => {
        const payload = (await response.json()) as SettingsPayload & { error?: string };
        if (!response.ok) {
          throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to load pricing settings');
        }
        return payload;
      })
      .then((payload) => {
        if (!cancelled) {
          setSettings({ services: [...payload.services], promoCodes: [...payload.promoCodes] });
          setSavedSnapshot(serializeSettings(payload));
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          notifyError(error instanceof Error ? error.message : 'Failed to load pricing settings');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);
  const executeSave = useCallback(async (): Promise<void> => {
    if (settings === null) {
      return;
    }
    setIsSaving(true);
    try {
      const response = await fetch(PRICING_SETTINGS_API_URL, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          services: settings.services.map((entry) => ({
            ...entry,
            deletedAt:
              entry.deletedAt !== null && entry.deletedAt !== undefined
                ? new Date(entry.deletedAt).toISOString()
                : null,
          })),
          promoCodes: settings.promoCodes.map((promo) => ({
            ...promo,
            validFrom:
              promo.validFrom !== null && promo.validFrom !== undefined
                ? new Date(promo.validFrom).toISOString()
                : null,
            validUntil:
              promo.validUntil !== null && promo.validUntil !== undefined
                ? new Date(promo.validUntil).toISOString()
                : null,
            deletedAt:
              promo.deletedAt !== null && promo.deletedAt !== undefined
                ? new Date(promo.deletedAt).toISOString()
                : null,
          })),
        }),
      });
      const payload = (await response.json()) as SettingsPayload & { error?: string };
      if (!response.ok) {
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to save pricing settings');
      }
      setSettings({ services: [...payload.services], promoCodes: [...payload.promoCodes] });
      setSavedSnapshot(serializeSettings(payload));
      notifySuccess('Pricing settings saved');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to save pricing settings');
    } finally {
      setIsSaving(false);
    }
  }, [settings]);
  const executeReset = useCallback((): void => {
    if (savedSnapshot.length === 0) {
      return;
    }
    const parsed = JSON.parse(savedSnapshot) as SettingsPayload;
    setSettings({ services: [...parsed.services], promoCodes: [...parsed.promoCodes] });
  }, [savedSnapshot]);
  useImperativeHandle(
    props.formRef,
    () => ({
      save: executeSave,
      reset: executeReset,
    }),
    [executeSave, executeReset],
  );
  useEffect(() => {
    onStateChangeRef.current?.({ isDirty, isSaving, isLoading });
  }, [isDirty, isLoading, isSaving]);
  const updateService = useCallback((index: number, patch: Partial<CatalogServiceEntry>): void => {
    setSettings((current) => {
      if (current === null) {
        return current;
      }
      const next = current.services.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
      return { ...current, services: next };
    });
  }, []);
  const updatePromo = useCallback((index: number, patch: Partial<PromoCodeEntry>): void => {
    setSettings((current) => {
      if (current === null) {
        return current;
      }
      const next = current.promoCodes.map((entry, i) => (i === index ? { ...entry, ...patch } : entry));
      return { ...current, promoCodes: next };
    });
  }, []);
  const sessionRows = useMemo(() => {
    if (settings === null) {
      return [];
    }
    return settings.services
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.kind === 'session')
      .filter(({ entry }) => showDeleted || !isDeletedAtSet(entry.deletedAt));
  }, [settings, showDeleted]);
  const packageRows = useMemo(() => {
    if (settings === null) {
      return [];
    }
    return settings.services
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.kind === 'package')
      .filter(({ entry }) => showDeleted || !isDeletedAtSet(entry.deletedAt));
  }, [settings, showDeleted]);
  const promoRows = useMemo(() => {
    if (settings === null) {
      return [];
    }
    return settings.promoCodes
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => showDeleted || !isDeletedAtSet(entry.deletedAt));
  }, [settings, showDeleted]);
  const openCreateCatalog = (kind: CatalogServiceKind): void => {
    setCatalogDialogKind(kind);
    setCatalogDialogMode('create');
    setCatalogEditIndex(null);
    setCatalogDraft(emptyCatalogDraft(kind));
    setCatalogDialogOpen(true);
  };
  const openEditCatalog = (index: number, entry: CatalogServiceEntry): void => {
    setCatalogDialogKind(entry.kind);
    setCatalogDialogMode('edit');
    setCatalogEditIndex(index);
    setCatalogDraft(catalogDraftFromEntry(entry));
    setCatalogDialogOpen(true);
  };
  const openCreatePromo = (): void => {
    setPromoDialogMode('create');
    setPromoEditIndex(null);
    setPromoDraft(emptyPromoDraft());
    setPromoDialogOpen(true);
  };
  const openEditPromo = (index: number, entry: PromoCodeEntry): void => {
    setPromoDialogMode('edit');
    setPromoEditIndex(index);
    setPromoDraft(promoDraftFromEntry(entry));
    setPromoDialogOpen(true);
  };
  const applyCatalogDraft = (): void => {
    if (settings === null) {
      return;
    }
    const serviceKey = normalizeServiceKey(catalogDraft.serviceKey);
    if (serviceKey.length === 0) {
      notifyError('Service key is required.');
      return;
    }
    const title = catalogDraft.title.trim();
    if (title.length === 0) {
      notifyError('Title is required.');
      return;
    }
    const sortOrderParsed = Number.parseInt(catalogDraft.sortOrder, 10);
    const sortOrder = Number.isFinite(sortOrderParsed) ? sortOrderParsed : 0;
    const sessionsParsed = Number.parseInt(catalogDraft.sessionsIncluded, 10);
    const sessionsIncluded =
      catalogDialogKind === 'package' && Number.isFinite(sessionsParsed) && sessionsParsed > 0
        ? sessionsParsed
        : null;
    const nextEntry: CatalogServiceEntry = {
      serviceKey,
      title,
      description: catalogDraft.description.trim().slice(0, 1000),
      durationLabel: catalogDraft.durationLabel.trim() || '60 minutes',
      amountCentavos: pesosToCentavos(catalogDraft.amountPesos),
      enabled: catalogDraft.enabled,
      sortOrder,
      kind: catalogDialogKind,
      sessionsIncluded,
      deletedAt: null,
    };
    if (catalogDialogMode === 'create') {
      const duplicate = settings.services.some((row) => row.serviceKey === serviceKey);
      if (duplicate) {
        notifyError('A service with this key already exists.');
        return;
      }
      setSettings({ ...settings, services: [...settings.services, nextEntry] });
    } else if (catalogEditIndex !== null) {
      const existing = settings.services[catalogEditIndex];
      updateService(catalogEditIndex, {
        ...nextEntry,
        deletedAt: existing?.deletedAt ?? null,
      });
    }
    setCatalogDialogOpen(false);
  };
  const applyPromoDraft = (): void => {
    if (settings === null) {
      return;
    }
    const code = normalizePromoCode(promoDraft.code);
    if (code.length === 0) {
      notifyError('Promo code is required.');
      return;
    }
    const discountValueParsed = Number.parseInt(promoDraft.discountValue, 10);
    const discountValue = Number.isFinite(discountValueParsed) ? discountValueParsed : 0;
    const maxRedemptionsParsed = Number.parseInt(promoDraft.maxRedemptions, 10);
    const maxRedemptions = Number.isFinite(maxRedemptionsParsed) ? maxRedemptionsParsed : 0;
    const keys = promoDraft.applicableServiceKeys
      .split(',')
      .map((key) => normalizeServiceKey(key))
      .filter((key) => key.length > 0);
    const validFromValue = promoDraft.validFrom.trim();
    const validUntilValue = promoDraft.validUntil.trim();
    const nextPromo: PromoCodeEntry = {
      code,
      discountType: promoDraft.discountType,
      discountValue,
      applicableServiceKeys: keys.length > 0 ? keys : null,
      maxRedemptions,
      redemptionCount:
        promoDialogMode === 'edit' && promoEditIndex !== null
          ? (settings.promoCodes[promoEditIndex]?.redemptionCount ?? 0)
          : 0,
      validFrom: validFromValue.length > 0 ? new Date(validFromValue) : null,
      validUntil: validUntilValue.length > 0 ? new Date(validUntilValue) : null,
      enabled: promoDraft.enabled,
      deletedAt: null,
    };
    if (promoDialogMode === 'create') {
      const duplicate = settings.promoCodes.some((row) => row.code === code);
      if (duplicate) {
        notifyError('A promo with this code already exists.');
        return;
      }
      setSettings({ ...settings, promoCodes: [...settings.promoCodes, nextPromo] });
    } else if (promoEditIndex !== null) {
      const existing = settings.promoCodes[promoEditIndex];
      updatePromo(promoEditIndex, {
        ...nextPromo,
        deletedAt: existing?.deletedAt ?? null,
      });
    }
    setPromoDialogOpen(false);
  };
  const executeSoftDelete = (): void => {
    if (deleteTarget === null || settings === null) {
      return;
    }
    const deletedAt = new Date();
    if (deleteTarget.type === 'service') {
      updateService(deleteTarget.index, { deletedAt, enabled: false });
    } else {
      updatePromo(deleteTarget.index, { deletedAt, enabled: false });
    }
    setDeleteTarget(null);
  };
  const executeRestore = (type: 'service' | 'promo', index: number): void => {
    if (type === 'service') {
      updateService(index, { deletedAt: null });
    } else {
      updatePromo(index, { deletedAt: null });
    }
  };
  if (isLoading || settings === null) {
    return <p className="text-sm text-muted-foreground">Loading pricing settings…</p>;
  }
  return (
    <div className="space-y-6">
      <p className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
        Per-service checkout prices apply before payment. The global fallback amount lives in{' '}
        <Link href="/admin/settings" className="font-medium text-primary underline-offset-4 hover:underline">
          Settings → Payments
        </Link>
        . Use <span className="font-medium text-foreground">Save pricing settings</span> in the footer to persist
        changes.
      </p>
      <Tabs
        value={pricingTab}
        onValueChange={(value) => {
          setPricingTab(value as PricingCatalogTab);
        }}
        className="space-y-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TabsList className="h-auto w-full flex-wrap justify-start gap-1 p-1 sm:w-auto">
            <TabsTrigger value="catalog" className="min-h-10 px-4 text-sm">
              Service catalog
            </TabsTrigger>
            <TabsTrigger value="packages" className="min-h-10 px-4 text-sm">
              Packages
            </TabsTrigger>
            <TabsTrigger value="promos" className="min-h-10 px-4 text-sm">
              Promo codes
            </TabsTrigger>
          </TabsList>
          <label className="flex min-h-10 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={showDeleted}
              onChange={(event) => {
                setShowDeleted(event.target.checked);
              }}
              className="size-4 rounded border-input"
            />
            Show deleted
          </label>
        </div>
        <TabsContent value="catalog" className="mt-0 space-y-4 focus-visible:outline-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Session SKUs used at checkout by service key. Disabled services fall back to the Payments tab amount.
            </p>
            <Button type="button" className="min-h-10 shrink-0" onClick={() => openCreateCatalog('session')}>
              <Plus className="size-4" aria-hidden />
              Add session
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service key</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>What&apos;s included</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessionRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No session services yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  sessionRows.map(({ entry, index }) => {
                    const status = resolveEntryStatus(entry);
                    const isDeleted = isDeletedAtSet(entry.deletedAt);
                    return (
                      <TableRow key={entry.serviceKey} className={cn(isDeleted && 'opacity-60')}>
                        <TableCell className="font-mono text-xs">{entry.serviceKey}</TableCell>
                        <TableCell className="max-w-48 truncate font-medium">{entry.title}</TableCell>
                        <TableCell className="max-w-xs text-muted-foreground" title={entry.description.trim() || undefined}>
                          <span className="line-clamp-2 text-sm">{truncateDescriptionPreview(entry.description)}</span>
                        </TableCell>
                        <TableCell>₱{centavosToPesos(entry.amountCentavos)}</TableCell>
                        <TableCell className="text-muted-foreground">{entry.durationLabel}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              aria-label={`Edit ${entry.title}`}
                              onClick={() => openEditCatalog(index, entry)}
                            >
                              <PencilLine className="size-4" aria-hidden />
                            </Button>
                            {isDeleted ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-9"
                                aria-label={`Restore ${entry.title}`}
                                onClick={() => executeRestore('service', index)}
                              >
                                <RotateCcw className="size-4" aria-hidden />
                              </Button>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="hidden h-9 sm:inline-flex"
                                  onClick={() => {
                                    updateService(index, { enabled: !entry.enabled });
                                  }}
                                >
                                  {entry.enabled ? 'Disable' : 'Enable'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-9 text-destructive hover:text-destructive"
                                  aria-label={`Delete ${entry.title}`}
                                  onClick={() => setDeleteTarget({ type: 'service', index })}
                                >
                                  <Trash2 className="size-4" aria-hidden />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="packages" className="mt-0 space-y-4 focus-visible:outline-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Bundle SKUs booked like sessions; set sessions included and bundle price.
            </p>
            <Button type="button" className="min-h-10 shrink-0" onClick={() => openCreateCatalog('package')}>
              <Plus className="size-4" aria-hidden />
              Add package
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Service key</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>What&apos;s included</TableHead>
                  <TableHead>Bundle price</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packageRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                      No packages yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  packageRows.map(({ entry, index }) => {
                    const status = resolveEntryStatus(entry);
                    const isDeleted = isDeletedAtSet(entry.deletedAt);
                    return (
                      <TableRow key={entry.serviceKey} className={cn(isDeleted && 'opacity-60')}>
                        <TableCell className="font-mono text-xs">{entry.serviceKey}</TableCell>
                        <TableCell className="max-w-48 truncate font-medium">{entry.title}</TableCell>
                        <TableCell className="max-w-xs text-muted-foreground" title={entry.description.trim() || undefined}>
                          <span className="line-clamp-2 text-sm">{truncateDescriptionPreview(entry.description)}</span>
                        </TableCell>
                        <TableCell>₱{centavosToPesos(entry.amountCentavos)}</TableCell>
                        <TableCell>{entry.sessionsIncluded ?? '—'}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              aria-label={`Edit ${entry.title}`}
                              onClick={() => openEditCatalog(index, entry)}
                            >
                              <PencilLine className="size-4" aria-hidden />
                            </Button>
                            {isDeleted ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-9"
                                aria-label={`Restore ${entry.title}`}
                                onClick={() => executeRestore('service', index)}
                              >
                                <RotateCcw className="size-4" aria-hidden />
                              </Button>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="hidden h-9 sm:inline-flex"
                                  onClick={() => {
                                    updateService(index, { enabled: !entry.enabled });
                                  }}
                                >
                                  {entry.enabled ? 'Disable' : 'Enable'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-9 text-destructive hover:text-destructive"
                                  aria-label={`Delete ${entry.title}`}
                                  onClick={() => setDeleteTarget({ type: 'service', index })}
                                >
                                  <Trash2 className="size-4" aria-hidden />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
        <TabsContent value="promos" className="mt-0 space-y-4 focus-visible:outline-none">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              Optional discounts at checkout. Leave max redemptions at 0 for unlimited.
            </p>
            <Button type="button" className="min-h-10 shrink-0" onClick={openCreatePromo}>
              <Plus className="size-4" aria-hidden />
              Add promo code
            </Button>
          </div>
          <div className="rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Discount</TableHead>
                  <TableHead>Redemptions</TableHead>
                  <TableHead>Validity</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promoRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                      No promo codes yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  promoRows.map(({ entry, index }) => {
                    const status = resolveEntryStatus(entry);
                    const isDeleted = isDeletedAtSet(entry.deletedAt);
                    const discountLabel =
                      entry.discountType === 'percent'
                        ? `${entry.discountValue}% off`
                        : `₱${centavosToPesos(entry.discountValue)} off`;
                    const validityLabel =
                      entry.validFrom || entry.validUntil
                        ? `${entry.validFrom ? formatPromoDate(entry.validFrom).slice(0, 10) : '…'} → ${entry.validUntil ? formatPromoDate(entry.validUntil).slice(0, 10) : '…'}`
                        : 'Always';
                    const redemptionLabel =
                      entry.maxRedemptions > 0
                        ? `${entry.redemptionCount} / ${entry.maxRedemptions}`
                        : `${entry.redemptionCount} (unlimited)`;
                    return (
                      <TableRow key={`${entry.code}-${index}`} className={cn(isDeleted && 'opacity-60')}>
                        <TableCell className="font-mono text-xs font-medium">{entry.code}</TableCell>
                        <TableCell>{discountLabel}</TableCell>
                        <TableCell className="text-muted-foreground">{redemptionLabel}</TableCell>
                        <TableCell className="text-muted-foreground">{validityLabel}</TableCell>
                        <TableCell>
                          <Badge variant={status.variant}>{status.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="size-9"
                              aria-label={`Edit promo ${entry.code}`}
                              onClick={() => openEditPromo(index, entry)}
                            >
                              <PencilLine className="size-4" aria-hidden />
                            </Button>
                            {isDeleted ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-9"
                                aria-label={`Restore promo ${entry.code}`}
                                onClick={() => executeRestore('promo', index)}
                              >
                                <RotateCcw className="size-4" aria-hidden />
                              </Button>
                            ) : (
                              <>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="hidden h-9 sm:inline-flex"
                                  onClick={() => {
                                    updatePromo(index, { enabled: !entry.enabled });
                                  }}
                                >
                                  {entry.enabled ? 'Disable' : 'Enable'}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="size-9 text-destructive hover:text-destructive"
                                  aria-label={`Delete promo ${entry.code}`}
                                  onClick={() => setDeleteTarget({ type: 'promo', index })}
                                >
                                  <Trash2 className="size-4" aria-hidden />
                                </Button>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>
      <div className="rounded-2xl border border-border bg-card p-6 shadow-xs">
        <div className="flex gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <CircleDollarSign className="size-5" aria-hidden />
          </span>
          <div>
            <h3 className="text-base font-semibold text-foreground">Custom quotes</h3>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Set a per-booking amount on the booking detail page (CRM → Bookings). Overrides catalog for that booking
              until expiry. Open a pending booking in{' '}
              <Link href="/admin/bookings" className="font-medium text-primary underline-offset-4 hover:underline">
                Admin → Bookings
              </Link>{' '}
              to set or clear a custom quote.
            </p>
          </div>
        </div>
      </div>
      <Dialog open={catalogDialogOpen} onOpenChange={setCatalogDialogOpen}>
        <DialogContent className="max-w-lg sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {catalogDialogMode === 'create'
                ? catalogDialogKind === 'package'
                  ? 'Add package'
                  : 'Add session service'
                : catalogDialogKind === 'package'
                  ? 'Edit package'
                  : 'Edit session service'}
            </DialogTitle>
            <DialogDescription>
              {catalogDialogMode === 'create'
                ? 'Service key is normalized to lowercase with hyphens. Save pricing settings to persist.'
                : 'Changes apply after you save pricing settings.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="catalog-service-key">Service key</Label>
              <Input
                id="catalog-service-key"
                value={catalogDraft.serviceKey}
                disabled={catalogDialogMode === 'edit'}
                placeholder="project-rescue"
                onChange={(event) => {
                  setCatalogDraft((draft) => ({ ...draft, serviceKey: event.target.value }));
                }}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="catalog-title">Title</Label>
              <Input
                id="catalog-title"
                value={catalogDraft.title}
                onChange={(event) => {
                  setCatalogDraft((draft) => ({ ...draft, title: event.target.value }));
                }}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="catalog-description">What&apos;s included</Label>
              <Textarea
                id="catalog-description"
                rows={4}
                maxLength={1000}
                placeholder="Describe deliverables, session format, and what the customer receives."
                value={catalogDraft.description}
                onChange={(event) => {
                  setCatalogDraft((draft) => ({ ...draft, description: event.target.value }));
                }}
              />
              <p className="text-xs text-muted-foreground">
                Shown to customers on diagnostic pricing and booking flows. {catalogDraft.description.length}/1000
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-price">Price (PHP)</Label>
              <Input
                id="catalog-price"
                type="number"
                min={1}
                step={0.01}
                value={catalogDraft.amountPesos}
                onChange={(event) => {
                  setCatalogDraft((draft) => ({ ...draft, amountPesos: event.target.value }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="catalog-sort">Sort order</Label>
              <Input
                id="catalog-sort"
                type="number"
                min={0}
                max={999}
                value={catalogDraft.sortOrder}
                onChange={(event) => {
                  setCatalogDraft((draft) => ({ ...draft, sortOrder: event.target.value }));
                }}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="catalog-duration">Duration label</Label>
              <Input
                id="catalog-duration"
                value={catalogDraft.durationLabel}
                onChange={(event) => {
                  setCatalogDraft((draft) => ({ ...draft, durationLabel: event.target.value }));
                }}
              />
            </div>
            {catalogDialogKind === 'package' ? (
              <div className="space-y-2">
                <Label htmlFor="catalog-sessions">Sessions included</Label>
                <Input
                  id="catalog-sessions"
                  type="number"
                  min={1}
                  max={99}
                  value={catalogDraft.sessionsIncluded}
                  onChange={(event) => {
                    setCatalogDraft((draft) => ({ ...draft, sessionsIncluded: event.target.value }));
                  }}
                />
              </div>
            ) : null}
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="catalog-enabled"
                type="checkbox"
                checked={catalogDraft.enabled}
                onChange={(event) => {
                  setCatalogDraft((draft) => ({ ...draft, enabled: event.target.checked }));
                }}
                className="size-4 rounded border-input"
              />
              <Label htmlFor="catalog-enabled" className="cursor-pointer font-normal">
                Enabled at checkout
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCatalogDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={applyCatalogDraft}>
              {catalogDialogMode === 'create' ? 'Add' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={promoDialogOpen} onOpenChange={setPromoDialogOpen}>
        <DialogContent className="max-w-lg sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{promoDialogMode === 'create' ? 'Add promo code' : 'Edit promo code'}</DialogTitle>
            <DialogDescription>
              Codes are normalized to uppercase without spaces. Save pricing settings to persist.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="promo-code">Code</Label>
              <Input
                id="promo-code"
                value={promoDraft.code}
                disabled={promoDialogMode === 'edit'}
                placeholder="LAUNCH10"
                onChange={(event) => {
                  setPromoDraft((draft) => ({ ...draft, code: event.target.value }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-type">Discount type</Label>
              <select
                id="promo-type"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={promoDraft.discountType}
                onChange={(event) => {
                  setPromoDraft((draft) => ({
                    ...draft,
                    discountType: event.target.value as PromoCodeEntry['discountType'],
                  }));
                }}
              >
                <option value="percent">Percent off</option>
                <option value="fixed_centavos">Fixed PHP off</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-value">
                {promoDraft.discountType === 'percent' ? 'Percent' : 'Amount (centavos)'}
              </Label>
              <Input
                id="promo-value"
                type="number"
                min={0}
                value={promoDraft.discountValue}
                onChange={(event) => {
                  setPromoDraft((draft) => ({ ...draft, discountValue: event.target.value }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-max">Max redemptions (0 = unlimited)</Label>
              <Input
                id="promo-max"
                type="number"
                min={0}
                value={promoDraft.maxRedemptions}
                onChange={(event) => {
                  setPromoDraft((draft) => ({ ...draft, maxRedemptions: event.target.value }));
                }}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="promo-services">Applicable service keys (comma-separated, empty = all)</Label>
              <Input
                id="promo-services"
                value={promoDraft.applicableServiceKeys}
                onChange={(event) => {
                  setPromoDraft((draft) => ({ ...draft, applicableServiceKeys: event.target.value }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-from">Valid from</Label>
              <Input
                id="promo-from"
                type="datetime-local"
                value={promoDraft.validFrom}
                onChange={(event) => {
                  setPromoDraft((draft) => ({ ...draft, validFrom: event.target.value }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="promo-until">Valid until</Label>
              <Input
                id="promo-until"
                type="datetime-local"
                value={promoDraft.validUntil}
                onChange={(event) => {
                  setPromoDraft((draft) => ({ ...draft, validUntil: event.target.value }));
                }}
              />
            </div>
            <div className="flex items-center gap-2 sm:col-span-2">
              <input
                id="promo-enabled"
                type="checkbox"
                checked={promoDraft.enabled}
                onChange={(event) => {
                  setPromoDraft((draft) => ({ ...draft, enabled: event.target.checked }));
                }}
                className="size-4 rounded border-input"
              />
              <Label htmlFor="promo-enabled" className="cursor-pointer font-normal">
                Enabled
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setPromoDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={applyPromoDraft}>
              {promoDialogMode === 'create' ? 'Add' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Soft-delete this item?</AlertDialogTitle>
            <AlertDialogDescription>
              It will be hidden from checkout and the public catalog. You can restore it later from this table (enable
              &quot;Show deleted&quot;). Save pricing settings to persist.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={executeSoftDelete}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
