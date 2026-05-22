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
import { format } from 'date-fns';
import { PencilLine, Plus, Search, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { AdminPageHeader } from '@/components/admin/admin-page-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { getBlogPostDisplayTitle, type BlogPostValue } from '@/lib/blog-post-types';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';

type BlogPostsListProps = {
  readonly initialPosts: readonly BlogPostValue[];
  readonly loadError?: string | null;
};

type BlogPostApiResponse = {
  readonly post?: BlogPostValue;
  readonly error?: string;
  readonly details?: string;
};

type BlogPostTableRow = {
  readonly id: string;
  readonly title: string;
  readonly slug: string;
  readonly status: BlogPostValue['status'];
  readonly showInBlogList: boolean;
  readonly showTitle: boolean;
  readonly createdAtIso: string;
  readonly updatedAtIso: string;
};

const BLOG_POSTS_API_URL = buildApiUrl('/api/admin/blog-posts');
const BLOG_TABLE_PAGE_SIZE = 10;
const BLOG_TABLE_COLUMN_HELPER = createColumnHelper<BlogPostTableRow>();
const ROW_INTERACTIVE_ELEMENT_SELECTOR =
  'button, a, input, textarea, select, [role="button"], [data-row-interactive="true"]';

function formatBlogDateTime(isoTimestamp: string): string {
  return format(new Date(isoTimestamp), 'MMM d, yyyy · h:mm a');
}

function isInteractiveRowTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return target.closest(ROW_INTERACTIVE_ELEMENT_SELECTOR) !== null;
}

export function BlogPostsList(props: BlogPostsListProps): ReactElement {
  const router = useRouter();
  const [posts, setPosts] = useState<readonly BlogPostValue[]>(props.initialPosts);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [postSearchValue, setPostSearchValue] = useState<string>('');
  const [tablePagination, setTablePagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: BLOG_TABLE_PAGE_SIZE,
  });
  const [tableSorting, setTableSorting] = useState<SortingState>([{ id: 'updatedAtIso', desc: true }]);
  const postRows = useMemo<readonly BlogPostTableRow[]>(
    () =>
      posts.map((post) => ({
        id: post.id,
        title: getBlogPostDisplayTitle(post),
        slug: post.slug,
        status: post.status,
        showInBlogList: post.showInBlogList,
        showTitle: post.showTitle,
        createdAtIso: post.createdAtIso,
        updatedAtIso: post.updatedAtIso,
      })),
    [posts],
  );
  const tableData = useMemo<BlogPostTableRow[]>(() => postRows.slice(), [postRows]);
  const executeOpenPost = useCallback(
    (postId: string): void => {
      router.push(`/admin/blog-posts/${postId}`);
    },
    [router],
  );

  async function executeCreatePost(): Promise<void> {
    setIsCreating(true);
    try {
      const response = await fetch(BLOG_POSTS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = (await response.json()) as BlogPostApiResponse;
      if (!response.ok || data.post === undefined) {
        throw new Error(data.details ?? data.error ?? 'Failed to create blog post.');
      }
      router.push(`/admin/blog-posts/${data.post.id}`);
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to create blog post.');
    } finally {
      setIsCreating(false);
    }
  }

  const executeDeletePost = useCallback(async (postId: string): Promise<void> => {
    const confirmed = window.confirm('Delete this blog post? This cannot be undone.');
    if (!confirmed) {
      return;
    }
    setDeletingPostId(postId);
    try {
      const response = await fetch(`${BLOG_POSTS_API_URL}/${postId}`, { method: 'DELETE' });
      const data = (await response.json()) as BlogPostApiResponse;
      if (!response.ok) {
        throw new Error(data.details ?? data.error ?? 'Failed to delete blog post.');
      }
      setPosts((previous) => previous.filter((post) => post.id !== postId));
      notifySuccess('Blog post deleted.');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to delete blog post.');
    } finally {
      setDeletingPostId(null);
    }
  }, []);

  const columns = useMemo(
    () => [
      BLOG_TABLE_COLUMN_HELPER.accessor('title', {
        header: 'Title',
        cell: (info) => <span className="font-medium text-foreground">{info.getValue()}</span>,
      }),
      BLOG_TABLE_COLUMN_HELPER.accessor('slug', {
        header: 'Slug',
        cell: (info) => <code className="text-xs text-muted-foreground">{info.getValue()}</code>,
      }),
      BLOG_TABLE_COLUMN_HELPER.accessor('status', {
        header: 'Status',
        cell: (info) => {
          const status = info.getValue();
          return (
            <span
              className={cn(
                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                status === 'published'
                  ? 'bg-primary/10 text-primary'
                  : 'bg-muted text-muted-foreground',
              )}
            >
              {status === 'published' ? 'Published' : 'Draft'}
            </span>
          );
        },
      }),
      BLOG_TABLE_COLUMN_HELPER.accessor('showInBlogList', {
        header: 'On /blog',
        cell: (info) => (
          <span className="text-xs text-muted-foreground">{info.getValue() ? 'Yes' : 'No'}</span>
        ),
      }),
      BLOG_TABLE_COLUMN_HELPER.accessor('showTitle', {
        header: 'Title',
        cell: (info) => (
          <span className="text-xs text-muted-foreground">{info.getValue() ? 'Shown' : 'Hidden'}</span>
        ),
      }),
      BLOG_TABLE_COLUMN_HELPER.accessor('updatedAtIso', {
        header: 'Updated',
        cell: (info) => <span className="text-muted-foreground">{formatBlogDateTime(info.getValue())}</span>,
      }),
      BLOG_TABLE_COLUMN_HELPER.display({
        id: 'actions',
        header: '',
        cell: (info) => (
          <div className="flex justify-end gap-1" data-row-interactive="true">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Edit post"
              onClick={() => executeOpenPost(info.row.original.id)}
            >
              <PencilLine className="size-4" aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Delete post"
              disabled={deletingPostId === info.row.original.id}
              onClick={() => void executeDeletePost(info.row.original.id)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </div>
        ),
      }),
    ],
    [deletingPostId, executeDeletePost, executeOpenPost],
  );

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table returns unstable refs; same pattern as diagnostic templates list.
  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      globalFilter: postSearchValue,
      pagination: tablePagination,
      sorting: tableSorting,
    },
    onGlobalFilterChange: setPostSearchValue,
    onPaginationChange: setTablePagination,
    onSortingChange: setTableSorting,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <section className="mx-auto space-y-8 w-full">
      <AdminPageHeader
        eyebrow="Content"
        title="Blog"
        description="Write markdown articles for the marketing site. Publish to show on /blog; copy embed ids for static pages."
        actions={
          <Button type="button" className="gap-2" disabled={isCreating} onClick={() => void executeCreatePost()}>
            <Plus className="size-4" aria-hidden />
            {isCreating ? 'Creating…' : 'New post'}
          </Button>
        }
      />
      <div className="space-y-4">
        {props.loadError !== undefined && props.loadError !== null ? (
          <p className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {props.loadError}
          </p>
        ) : null}
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={postSearchValue}
            onChange={(event) => setPostSearchValue(event.target.value)}
            placeholder="Search posts…"
            className="pl-9"
            aria-label="Search blog posts"
          />
        </div>
        <div className="overflow-hidden rounded-xl border border-border">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-muted/40">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th key={header.id} className="px-4 py-3 text-left font-medium text-muted-foreground">
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-4 py-10 text-center text-muted-foreground">
                    No blog posts yet. Create your first post.
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="cursor-pointer border-b border-border/80 transition-colors last:border-0 hover:bg-muted/30"
                    onClick={(event) => {
                      if (isInteractiveRowTarget(event.target)) {
                        return;
                      }
                      executeOpenPost(row.original.id);
                    }}
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
        {table.getPageCount() > 1 ? (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <p>
              Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
              >
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
              >
                Next
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
