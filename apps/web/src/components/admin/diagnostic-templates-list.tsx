'use client';

import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type PaginationState,
  type SortingState,
} from '@tanstack/react-table';
import { CheckCircle2, PencilLine, Plus, Search, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { notifyError, notifySuccess } from '@/lib/notify';
import type { DiagnosticTemplateValue } from '@/lib/diagnostic-template-types';
import { cn } from '@/lib/utils';

type DiagnosticTemplatesListProps = {
  readonly initialTemplates: readonly DiagnosticTemplateValue[];
};

type TemplateApiResponse = {
  readonly template?: DiagnosticTemplateValue;
  readonly error?: string;
  readonly details?: string;
};

type DiagnosticTemplateTableRow = {
  readonly id: string;
  readonly name: string;
  readonly isActive: boolean;
  readonly roundCount: number;
  readonly questionCount: number;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
};

const DIAGNOSTIC_TEMPLATES_API_URL = buildApiUrl('/api/admin/diagnostic-templates');
const TEMPLATE_TABLE_PAGE_SIZE = 7;
const TEMPLATE_TABLE_COLUMN_HELPER = createColumnHelper<DiagnosticTemplateTableRow>();
const TEMPLATE_DATE_TIME_FORMATTER = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});
const ROW_INTERACTIVE_ELEMENT_SELECTOR =
  'button, a, input, textarea, select, [role="button"], [data-row-interactive="true"]';

function countTemplateQuestions(template: DiagnosticTemplateValue): number {
  return template.rounds.reduce((total, round) => total + round.questions.length, 0);
}

function formatTemplateDateTime(isoTimestamp: string): string {
  return TEMPLATE_DATE_TIME_FORMATTER.format(new Date(isoTimestamp));
}

function isInteractiveRowTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.closest(ROW_INTERACTIVE_ELEMENT_SELECTOR) !== null;
}

export function DiagnosticTemplatesList(props: DiagnosticTemplatesListProps): ReactElement {
  const router = useRouter();
  const [templates, setTemplates] = useState<readonly DiagnosticTemplateValue[]>(props.initialTemplates);
  const [isCreateFormOpen, setIsCreateFormOpen] = useState<boolean>(props.initialTemplates.length === 0);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [activatingTemplateId, setActivatingTemplateId] = useState<string | null>(null);
  const [deletingTemplateId, setDeletingTemplateId] = useState<string | null>(null);
  const [newTemplateName, setNewTemplateName] = useState<string>('');
  const [templateSearchValue, setTemplateSearchValue] = useState<string>('');
  const [templateTablePagination, setTemplateTablePagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: TEMPLATE_TABLE_PAGE_SIZE,
  });
  const [templateTableSorting, setTemplateTableSorting] = useState<SortingState>([
    { id: 'isActive', desc: true },
    { id: 'updatedAtIso', desc: true },
  ]);
  const templateRows = useMemo<readonly DiagnosticTemplateTableRow[]>(
    () =>
      templates.map((template) => ({
        id: template.id,
        name: template.name,
        isActive: template.isActive,
        roundCount: template.rounds.length,
        questionCount: countTemplateQuestions(template),
        createdAtIso: template.createdAtIso,
        updatedAtIso: template.updatedAtIso,
      })),
    [templates],
  );
  const templateTableData = useMemo<DiagnosticTemplateTableRow[]>(() => templateRows.slice(), [templateRows]);
  const executeOpenTemplate = useCallback(
    (templateId: string): void => {
      router.push(`/admin/diagnostic-templates/${templateId}`);
    },
    [router],
  );

  async function executeCreateTemplate(templateName?: string): Promise<void> {
    setIsCreating(true);
    try {
      const trimmedTemplateName = templateName?.trim() ?? '';
      const response = await fetch(DIAGNOSTIC_TEMPLATES_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(trimmedTemplateName.length > 0 ? { name: trimmedTemplateName } : {}),
      });
      const data = (await response.json()) as TemplateApiResponse;
      if (!response.ok || data.template === undefined) {
        throw new Error(data.details ?? data.error ?? 'Failed to create diagnostic template.');
      }
      setNewTemplateName('');
      setIsCreateFormOpen(false);
      router.push(`/admin/diagnostic-templates/${data.template.id}`);
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to create diagnostic template.');
    } finally {
      setIsCreating(false);
    }
  }

  const executeActivateTemplate = useCallback(async (templateId: string): Promise<void> => {
    setActivatingTemplateId(templateId);
    try {
      const response = await fetch(`${DIAGNOSTIC_TEMPLATES_API_URL}/${templateId}/activate`, {
        method: 'POST',
      });
      const data = (await response.json()) as TemplateApiResponse;
      if (!response.ok || data.template === undefined) {
        throw new Error(data.details ?? data.error ?? 'Failed to activate diagnostic template.');
      }
      setTemplates((previous) =>
        previous.map((template) =>
          template.id === data.template!.id
            ? data.template!
            : {
                ...template,
                isActive: false,
              },
        ),
      );
      notifySuccess(`"${data.template.name}" is now active for customer-facing diagnostics.`);
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to activate diagnostic template.');
    } finally {
      setActivatingTemplateId(null);
    }
  }, []);

  const executeDeleteTemplate = useCallback(async (templateId: string): Promise<void> => {
    const templateToDelete = templates.find((template) => template.id === templateId);
    if (templateToDelete === undefined) {
      return;
    }
    const confirmed = window.confirm(`Delete "${templateToDelete.name}"? This cannot be undone.`);
    if (!confirmed) {
      return;
    }
    setDeletingTemplateId(templateId);
    try {
      const response = await fetch(`${DIAGNOSTIC_TEMPLATES_API_URL}/${templateId}`, {
        method: 'DELETE',
      });
      const data = (await response.json()) as { readonly error?: string; readonly details?: string };
      if (!response.ok) {
        throw new Error(data.details ?? data.error ?? 'Failed to delete diagnostic template.');
      }
      setTemplates((previous) => previous.filter((template) => template.id !== templateId));
      notifySuccess('Template deleted.');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to delete diagnostic template.');
    } finally {
      setDeletingTemplateId(null);
    }
  }, [templates]);

  const templateColumns = useMemo(
    () => [
      TEMPLATE_TABLE_COLUMN_HELPER.accessor('name', {
        header: 'Template',
        cell: (info) => (
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{info.getValue()}</p>
            <p className="text-xs text-muted-foreground">Created {formatTemplateDateTime(info.row.original.createdAtIso)}</p>
          </div>
        ),
      }),
      TEMPLATE_TABLE_COLUMN_HELPER.accessor('roundCount', {
        header: 'Rounds',
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      TEMPLATE_TABLE_COLUMN_HELPER.accessor('questionCount', {
        header: 'Questions',
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      TEMPLATE_TABLE_COLUMN_HELPER.accessor('updatedAtIso', {
        header: 'Updated',
        cell: (info) => <span className="text-sm text-muted-foreground">{formatTemplateDateTime(info.getValue())}</span>,
      }),
      TEMPLATE_TABLE_COLUMN_HELPER.accessor('isActive', {
        header: 'Status',
        cell: (info) => (
          <span
            className={cn(
              'inline-flex items-center rounded-full border px-2 py-1 text-[11px] font-semibold',
              info.getValue()
                ? 'border-primary/30 bg-primary/10 text-primary'
                : 'border-border bg-muted/60 text-muted-foreground',
            )}
          >
            {info.getValue() ? 'Active' : 'Draft'}
          </span>
        ),
      }),
      TEMPLATE_TABLE_COLUMN_HELPER.display({
        id: 'actions',
        header: 'Actions',
        cell: (info) => {
          const isActiveTemplate = info.row.original.isActive;
          return (
            <div
              data-row-interactive="true"
              className="flex items-center justify-end gap-1"
              onClick={(event) => {
                event.stopPropagation();
              }}
              onKeyDown={(event) => {
                event.stopPropagation();
              }}
            >
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Edit ${info.row.original.name}`}
                title={`Edit ${info.row.original.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  executeOpenTemplate(info.row.original.id);
                }}
              >
                <PencilLine className="size-4" aria-hidden />
              </Button>
              {!isActiveTemplate ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Set ${info.row.original.name} active`}
                  title="Set active"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void executeActivateTemplate(info.row.original.id);
                  }}
                  disabled={activatingTemplateId === info.row.original.id}
                >
                  <CheckCircle2 className="size-4" aria-hidden />
                </Button>
              ) : null}
              {!isActiveTemplate ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete ${info.row.original.name}`}
                  title={`Delete ${info.row.original.name}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    void executeDeleteTemplate(info.row.original.id);
                  }}
                  disabled={deletingTemplateId === info.row.original.id}
                >
                  <Trash2 className="size-4 text-destructive" aria-hidden />
                </Button>
              ) : null}
            </div>
          );
        },
      }),
    ],
    [activatingTemplateId, deletingTemplateId, executeActivateTemplate, executeDeleteTemplate, executeOpenTemplate],
  );
  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns unstable refs for pagination and row models; intentional here.
  const templateTable = useReactTable({
    data: templateTableData,
    columns: templateColumns,
    state: {
      globalFilter: templateSearchValue,
      pagination: templateTablePagination,
      sorting: templateTableSorting,
    },
    onGlobalFilterChange: setTemplateSearchValue,
    onPaginationChange: setTemplateTablePagination,
    onSortingChange: setTemplateTableSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: 'includesString',
  });
  const filteredTemplateCount = templateTable.getFilteredRowModel().rows.length;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        eyebrow="Customer diagnostic"
        title="Diagnostic templates"
        description="Manage your template library from one table, then open any template on its own detail page to edit rounds, questions, and options."
        actions={
          <Button type="button" onClick={() => setIsCreateFormOpen(true)} disabled={isCreating}>
            <Plus className="size-4" aria-hidden />
            New template
          </Button>
        }
      />
      <section data-admin-tour="page-templates-list">
        <div className="flex flex-col gap-4 border-b border-border pb-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={templateSearchValue}
              onChange={(event) => setTemplateSearchValue(event.target.value)}
              placeholder="Search template name"
              className="pl-9"
              aria-label="Search templates"
            />
          </div>
          {isCreateFormOpen ? (
            <form
              className="rounded-2xl border border-primary/20 bg-primary/5 p-4"
              onSubmit={(event) => {
                event.preventDefault();
                void executeCreateTemplate(newTemplateName);
              }}
            >
              <div className="space-y-3">
                <div className="space-y-2">
                  <label htmlFor="new-diagnostic-template-name" className="text-sm font-medium text-foreground">
                    New template name
                  </label>
                  <Input
                    id="new-diagnostic-template-name"
                    value={newTemplateName}
                    onChange={(event) => setNewTemplateName(event.target.value)}
                    placeholder="Example: Managed services intake"
                  />
                  <p className="text-xs text-muted-foreground">
                    Leave this blank if you want the system to generate a default name.
                  </p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsCreateFormOpen(false);
                      setNewTemplateName('');
                    }}
                    disabled={isCreating}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? 'Creating…' : 'Create template'}
                  </Button>
                </div>
              </div>
            </form>
          ) : null}
        </div>
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between gap-3 px-2">
            <p className="text-sm text-muted-foreground">
              {filteredTemplateCount} of {templates.length} templates
            </p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-muted/40">
                {templateTable.getHeaderGroups().map((headerGroup) => (
                  <tr key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <th key={header.id} className="px-4 py-3 text-left align-middle font-medium text-muted-foreground">
                        {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody>
                {templateTable.getRowModel().rows.length === 0 ? (
                  <tr>
                    <td colSpan={templateColumns.length} className="px-4 py-8 text-center text-muted-foreground">
                      {templates.length === 0
                        ? 'Create your first template to start managing rounds, questions, and options.'
                        : 'No templates match your search.'}
                    </td>
                  </tr>
                ) : (
                  templateTable.getRowModel().rows.map((row) => (
                    <tr
                      key={row.id}
                      tabIndex={0}
                      onClick={(event) => {
                        if (event.defaultPrevented || isInteractiveRowTarget(event.target)) {
                          return;
                        }
                        router.push(`/admin/diagnostic-templates/${row.original.id}`);
                      }}
                      onKeyDown={(event) => {
                        if (event.defaultPrevented || isInteractiveRowTarget(event.target)) {
                          return;
                        }
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          router.push(`/admin/diagnostic-templates/${row.original.id}`);
                        }
                      }}
                      className="cursor-pointer border-b border-border outline-none transition-colors hover:bg-muted/40 focus-visible:bg-primary/5"
                    >
                      {row.getVisibleCells().map((cell) => (
                        <td key={cell.id} className="px-4 py-3 align-middle">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 px-2">
            <p className="text-sm text-muted-foreground">
              Page {templateTable.getState().pagination.pageIndex + 1} of {Math.max(1, templateTable.getPageCount())}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => templateTable.previousPage()}
                disabled={!templateTable.getCanPreviousPage()}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => templateTable.nextPage()}
                disabled={!templateTable.getCanNextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
