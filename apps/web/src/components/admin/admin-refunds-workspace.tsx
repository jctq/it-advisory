'use client';

import { CircleCheckBig, CircleHelp, Inbox, Search } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { AdminRefundsTable } from '@/components/admin/admin-refunds-table';
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
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import { useAdminRefundsQuery } from '@/hooks/admin/use-admin-refunds-query';
import { useAdminDebugTablePagination } from '@/hooks/admin/use-admin-debug-table-pagination';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { ADMIN_DEBUG_SEARCH_DEBOUNCE_MS } from '@/lib/admin/admin-paginated-list';
import type {
  BookingRefundListSearchField,
  BookingRefundListStatusFilter,
  BookingRefundRow,
  BookingRefundStatusCounts,
} from '@/lib/data/booking-refunds';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';

type StatusFilterOption = {
  readonly id: BookingRefundListStatusFilter;
  readonly label: string;
  readonly shortLabel: string;
  readonly icon: typeof Inbox;
};

const EMPTY_COUNTS: BookingRefundStatusCounts = {
  all: 0,
  awaiting: 0,
  completed: 0,
};

const STATUS_FILTER_OPTIONS: readonly StatusFilterOption[] = [
  { id: 'all', label: 'All refund requests', shortLabel: 'All', icon: Inbox },
  { id: 'awaiting', label: 'Awaiting refund', shortLabel: 'Awaiting', icon: CircleHelp },
  { id: 'completed', label: 'Completed refunds', shortLabel: 'Completed', icon: CircleCheckBig },
];

type RefundSearchFieldOption = {
  readonly id: BookingRefundListSearchField;
  readonly label: string;
  readonly placeholder: string;
};

const REFUND_SEARCH_FIELD_OPTIONS: readonly RefundSearchFieldOption[] = [
  { id: 'reference', label: 'Reference', placeholder: 'Booking reference…' },
  { id: 'contact', label: 'Contact', placeholder: 'Contact name…' },
  { id: 'email', label: 'Email', placeholder: 'Email address…' },
  { id: 'status', label: 'Status', placeholder: 'awaiting or completed…' },
];

function resolveRefundSearchPlaceholder(searchField: BookingRefundListSearchField): string {
  return REFUND_SEARCH_FIELD_OPTIONS.find((option) => option.id === searchField)?.placeholder ?? 'Search…';
}

function formatAmountPhp(centavos: number): string {
  return `₱${(centavos / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function resolveStatusCount(
  counts: BookingRefundStatusCounts,
  filter: BookingRefundListStatusFilter,
): number {
  return counts[filter];
}

/**
 * Admin refunds workspace: status filters, paginated table, and mark-refunded dialog.
 */
export function AdminRefundsWorkspace(): ReactElement {
  const [statusFilter, setStatusFilter] = useState<BookingRefundListStatusFilter>('all');
  const [searchField, setSearchField] = useState<BookingRefundListSearchField>('reference');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, ADMIN_DEBUG_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timeoutId);
  }, [searchInput]);
  const hasActiveSearch = debouncedSearch.length > 0;
  const filterSignature = hasActiveSearch
    ? `${statusFilter}\0${searchField}\0${debouncedSearch}`
    : statusFilter;
  const [pagination, setPagination] = useAdminDebugTablePagination(filterSignature);
  const queryFilters = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      status: statusFilter,
      ...(hasActiveSearch ? { searchField, search: debouncedSearch } : {}),
    }),
    [debouncedSearch, hasActiveSearch, pagination.pageIndex, pagination.pageSize, searchField, statusFilter],
  );
  const query = useAdminRefundsQuery(queryFilters);
  const rows = query.data?.rows ?? [];
  const totalCount = query.data?.totalCount ?? 0;
  const totalPages = query.data?.totalPages ?? 0;
  const countsByStatus = query.data?.countsByStatus ?? EMPTY_COUNTS;
  const isLoading = query.isLoading || query.isFetching;
  const [selectedRefund, setSelectedRefund] = useState<BookingRefundRow | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const activeFilterLabel =
    STATUS_FILTER_OPTIONS.find((option) => option.id === statusFilter)?.label ?? 'All refund requests';
  const openCompleteDialog = (row: BookingRefundRow): void => {
    setSelectedRefund(row);
    setRefundAmountInput(String(row.requestedAmountCentavos / 100));
    setAdminNotes('');
  };
  const executeCompleteRefund = async (): Promise<void> => {
    if (selectedRefund === null) {
      return;
    }
    const parsedAmount = Number.parseFloat(refundAmountInput.replace(/,/g, ''));
    if (!Number.isFinite(parsedAmount) || parsedAmount < 0) {
      notifyError('Enter a valid refund amount.');
      return;
    }
    setIsCompleting(true);
    try {
      const response = await fetch(buildApiUrl(`/api/admin/refunds/${selectedRefund.id}/complete`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refundAmountCentavos: Math.round(parsedAmount * 100),
          adminNotes: adminNotes.trim().length > 0 ? adminNotes.trim() : undefined,
        }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok || payload.ok !== true) {
        notifyError(typeof payload.error === 'string' ? payload.error : 'Failed to mark refund complete.');
        return;
      }
      notifySuccess('Refund marked as completed.');
      setSelectedRefund(null);
      await query.refetch();
    } catch {
      notifyError('Failed to mark refund complete.');
    } finally {
      setIsCompleting(false);
    }
  };
  return (
    <div className="flex flex-col gap-6">
      <div className="min-w-0 space-y-3">
        <div className="min-w-0 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/80 px-3 py-2">
            <p className="min-w-0 text-xs text-muted-foreground sm:text-sm">
              {isLoading ? (
                'Loading refunds…'
              ) : (
                <>
                  <span className="font-medium text-foreground">{totalCount.toLocaleString()}</span>{' '}
                  {totalCount === 1 ? 'request' : 'requests'}
                  {statusFilter === 'all' ? '' : ` · ${activeFilterLabel}`}
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-b border-border/80 px-3 py-2">
            <div
              className="-mx-1 flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5 scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
              role="group"
              aria-label="Filter refunds by status"
            >
              {STATUS_FILTER_OPTIONS.map((option) => {
                const Icon = option.icon;
                const isActive = statusFilter === option.id;
                const count = resolveStatusCount(countsByStatus, option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setStatusFilter(option.id)}
                    aria-label={`${option.label} (${isLoading ? '…' : count})`}
                    aria-pressed={isActive}
                    className={cn(
                      'inline-flex min-h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30',
                      isActive
                        ? 'border-primary/30 bg-primary/10 text-foreground'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    <Icon
                      className={cn('size-3.5 shrink-0', isActive ? 'text-primary' : 'opacity-70')}
                      aria-hidden
                    />
                    <span>{option.shortLabel}</span>
                    <span
                      className={cn(
                        'rounded px-1.5 py-px text-[0.6875rem] tabular-nums leading-none',
                        isActive
                          ? 'bg-primary/15 font-semibold text-foreground'
                          : 'bg-muted text-muted-foreground',
                      )}
                      aria-hidden
                    >
                      {isLoading ? '…' : count}
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex min-w-0 w-full items-center gap-2 sm:w-auto sm:min-w-[18rem] sm:max-w-md lg:ml-auto">
              <NativeSelect
                id="admin-refunds-search-field"
                value={searchField}
                onChange={(event) => setSearchField(event.target.value as BookingRefundListSearchField)}
                className="h-9 w-30 shrink-0"
                aria-label="Search field"
              >
                {REFUND_SEARCH_FIELD_OPTIONS.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </NativeSelect>
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="admin-refunds-search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={resolveRefundSearchPlaceholder(searchField)}
                  className="h-9 pl-9"
                  aria-label={`Search refunds by ${searchField}`}
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>
            </div>
          </div>
          {query.isError ? (
            <p className="px-3 py-4 text-sm text-destructive" role="alert">
              {query.error.message}
            </p>
          ) : (
            <AdminRefundsTable
              rows={rows}
              isLoading={isLoading}
              emptyMessage={
                debouncedSearch.length > 0
                  ? 'No refund requests matched your search.'
                  : 'No refund requests found.'
              }
              manualPagination
              pageCount={totalPages}
              totalCount={totalCount}
              pagination={pagination}
              onPaginationChange={setPagination}
              onMarkRefunded={openCompleteDialog}
            />
          )}
        </div>
      </div>
      <Dialog open={selectedRefund !== null} onOpenChange={(open) => !open && setSelectedRefund(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark refund complete</DialogTitle>
            <DialogDescription>
              Confirm the amount refunded to the customer. This updates the booking status to refunded.
            </DialogDescription>
          </DialogHeader>
          {selectedRefund !== null ? (
            <div className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground">
                Booking <span className="font-mono font-medium text-foreground">{selectedRefund.bookingReference}</span>{' '}
                · requested {formatAmountPhp(selectedRefund.requestedAmountCentavos)}
              </p>
              <div className="space-y-2">
                <Label htmlFor="admin-refund-amount">Refund amount (PHP)</Label>
                <Input
                  id="admin-refund-amount"
                  inputMode="decimal"
                  value={refundAmountInput}
                  onChange={(event) => setRefundAmountInput(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="admin-refund-notes">Admin notes (optional)</Label>
                <Textarea
                  id="admin-refund-notes"
                  value={adminNotes}
                  onChange={(event) => setAdminNotes(event.target.value)}
                  rows={3}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setSelectedRefund(null)} disabled={isCompleting}>
              Cancel
            </Button>
            <Button type="button" onClick={() => void executeCompleteRefund()} disabled={isCompleting}>
              {isCompleting ? 'Saving…' : 'Confirm refunded'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
