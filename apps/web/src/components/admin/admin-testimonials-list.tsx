'use client';

import { PencilLine, Plus, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState, type ReactElement } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { TestimonialValue } from '@/lib/testimonial-types';
import { cn } from '@/lib/utils';

type AdminTestimonialsListProps = {
  readonly initialTestimonials: readonly TestimonialValue[];
  readonly loadError?: string | null;
};

type TestimonialApiResponse = {
  readonly testimonial?: TestimonialValue;
  readonly error?: string;
  readonly details?: string;
};

type TestimonialFormState = {
  readonly quote: string;
  readonly name: string;
  readonly role: string;
  readonly status: TestimonialValue['status'];
  readonly sortOrder: string;
};

const TESTIMONIALS_API_URL = buildApiUrl('/api/admin/testimonials');

function buildEmptyFormState(): TestimonialFormState {
  return {
    quote: '',
    name: '',
    role: '',
    status: 'draft',
    sortOrder: '0',
  };
}

function buildFormStateFromTestimonial(testimonial: TestimonialValue): TestimonialFormState {
  return {
    quote: testimonial.quote,
    name: testimonial.name,
    role: testimonial.role,
    status: testimonial.status,
    sortOrder: String(testimonial.sortOrder),
  };
}

function parseSortOrder(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }
  if (parsed > 9999) {
    return 9999;
  }
  return parsed;
}

export function AdminTestimonialsList(props: AdminTestimonialsListProps): ReactElement {
  const [testimonials, setTestimonials] = useState<readonly TestimonialValue[]>(props.initialTestimonials);
  const [dialogOpen, setDialogOpen] = useState<boolean>(false);
  const [editingTestimonialId, setEditingTestimonialId] = useState<string | null>(null);
  const [formState, setFormState] = useState<TestimonialFormState>(buildEmptyFormState);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [deletingTestimonialId, setDeletingTestimonialId] = useState<string | null>(null);

  const executeOpenCreate = useCallback((): void => {
    setEditingTestimonialId(null);
    setFormState(buildEmptyFormState());
    setDialogOpen(true);
  }, []);

  const executeOpenEdit = useCallback((testimonial: TestimonialValue): void => {
    setEditingTestimonialId(testimonial.id);
    setFormState(buildFormStateFromTestimonial(testimonial));
    setDialogOpen(true);
  }, []);

  const executeSave = useCallback(async (): Promise<void> => {
    const quote = formState.quote.trim();
    const name = formState.name.trim();
    const role = formState.role.trim();
    if (quote.length === 0 || name.length === 0) {
      notifyError('Quote and name are required.');
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        quote,
        name,
        role,
        status: formState.status,
        sortOrder: parseSortOrder(formState.sortOrder),
      };
      const response = await fetch(
        editingTestimonialId === null
          ? TESTIMONIALS_API_URL
          : `${TESTIMONIALS_API_URL}/${editingTestimonialId}`,
        {
          method: editingTestimonialId === null ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const data = (await response.json()) as TestimonialApiResponse;
      if (!response.ok || data.testimonial === undefined) {
        throw new Error(data.details ?? data.error ?? 'Failed to save testimonial.');
      }
      if (editingTestimonialId === null) {
        setTestimonials((current) => [...current, data.testimonial!].sort((left, right) => left.sortOrder - right.sortOrder));
      } else {
        setTestimonials((current) =>
          current
            .map((item) => (item.id === data.testimonial!.id ? data.testimonial! : item))
            .sort((left, right) => left.sortOrder - right.sortOrder),
        );
      }
      setDialogOpen(false);
      notifySuccess('Testimonial saved.');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to save testimonial.');
    } finally {
      setIsSaving(false);
    }
  }, [editingTestimonialId, formState]);

  const executeDelete = useCallback(async (testimonialId: string): Promise<void> => {
    const confirmed = window.confirm('Delete this testimonial? This cannot be undone.');
    if (!confirmed) {
      return;
    }
    setDeletingTestimonialId(testimonialId);
    try {
      const response = await fetch(`${TESTIMONIALS_API_URL}/${testimonialId}`, { method: 'DELETE' });
      const data = (await response.json()) as { readonly error?: string; readonly details?: string };
      if (!response.ok) {
        throw new Error(data.details ?? data.error ?? 'Failed to delete testimonial.');
      }
      setTestimonials((current) => current.filter((item) => item.id !== testimonialId));
      notifySuccess('Testimonial deleted.');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to delete testimonial.');
    } finally {
      setDeletingTestimonialId(null);
    }
  }, []);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Marketing"
        title="Testimonials"
        description="Published quotes appear on the marketing homepage when testimonials are enabled in Settings."
        actions={
          <Button type="button" onClick={executeOpenCreate}>
            <Plus className="size-4" aria-hidden />
            Add testimonial
          </Button>
        }
      />
      {props.loadError !== null && props.loadError !== undefined ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {props.loadError}
        </p>
      ) : null}
      <p className="text-sm text-muted-foreground">
        Enable the module under{' '}
        <Link href="/admin/settings" className="font-medium text-primary underline-offset-4 hover:underline">
          Settings → Marketing testimonials
        </Link>
        . The homepage band shows only when the module is on and at least one testimonial is published.
      </p>
      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-border bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">Order</th>
              <th className="px-4 py-3 font-semibold">Quote</th>
              <th className="px-4 py-3 font-semibold">Attribution</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {testimonials.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  No testimonials yet. Add your first quote to show on the homepage.
                </td>
              </tr>
            ) : (
              testimonials.map((testimonial) => (
                <tr key={testimonial.id} className="border-b border-border/70 last:border-0">
                  <td className="px-4 py-3 align-top tabular-nums text-muted-foreground">{testimonial.sortOrder}</td>
                  <td className="max-w-md px-4 py-3 align-top">
                    <p className="line-clamp-3 text-foreground">{testimonial.quote || '—'}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-foreground">{testimonial.name || '—'}</p>
                    <p className="mt-1 text-muted-foreground">{testimonial.role || '—'}</p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize',
                        testimonial.status === 'published'
                          ? 'bg-primary/10 text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {testimonial.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => executeOpenEdit(testimonial)}>
                        <PencilLine className="size-4" aria-hidden />
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={deletingTestimonialId === testimonial.id}
                        onClick={() => void executeDelete(testimonial.id)}
                      >
                        <Trash2 className="size-4" aria-hidden />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTestimonialId === null ? 'Add testimonial' : 'Edit testimonial'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="testimonial-quote" className="text-sm font-medium text-foreground">
                Quote
              </label>
              <Textarea
                id="testimonial-quote"
                value={formState.quote}
                onChange={(event) => {
                  setFormState((current) => ({ ...current, quote: event.target.value }));
                }}
                rows={4}
                maxLength={500}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="testimonial-name" className="text-sm font-medium text-foreground">
                Name
              </label>
              <Input
                id="testimonial-name"
                value={formState.name}
                onChange={(event) => {
                  setFormState((current) => ({ ...current, name: event.target.value }));
                }}
                maxLength={120}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="testimonial-role" className="text-sm font-medium text-foreground">
                Role / company
              </label>
              <Input
                id="testimonial-role"
                value={formState.role}
                onChange={(event) => {
                  setFormState((current) => ({ ...current, role: event.target.value }));
                }}
                maxLength={120}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label htmlFor="testimonial-status" className="text-sm font-medium text-foreground">
                  Status
                </label>
                <select
                  id="testimonial-status"
                  value={formState.status}
                  onChange={(event) => {
                    setFormState((current) => ({
                      ...current,
                      status: event.target.value as TestimonialValue['status'],
                    }));
                  }}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </div>
              <div className="space-y-2">
                <label htmlFor="testimonial-sort-order" className="text-sm font-medium text-foreground">
                  Sort order
                </label>
                <Input
                  id="testimonial-sort-order"
                  type="number"
                  min={0}
                  max={9999}
                  value={formState.sortOrder}
                  onChange={(event) => {
                    setFormState((current) => ({ ...current, sortOrder: event.target.value }));
                  }}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" disabled={isSaving} onClick={() => void executeSave()}>
              {isSaving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
