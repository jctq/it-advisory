'use client';

import { format } from 'date-fns';
import { ChevronRight, History, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { BlogPostRevisionDiffView } from '@/components/admin/blog-post-revision-diff-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { BLOG_POST_REVISION_FIELD_LABELS, type BlogPostRevisionDetail, type BlogPostRevisionListItem } from '@/lib/blog-post-revision-types';
import { notifyError } from '@/lib/notify';
import { cn } from '@/lib/utils';

type BlogPostEditHistoryDialogProps = {
  readonly postId: string;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly refreshKey?: number;
};

type RevisionsListResponse = {
  readonly revisions?: readonly BlogPostRevisionListItem[];
  readonly error?: string;
  readonly details?: string;
};

type RevisionDetailResponse = {
  readonly revision?: BlogPostRevisionDetail;
  readonly error?: string;
  readonly details?: string;
};

function formatRevisionSavedAt(isoTimestamp: string): string {
  return format(new Date(isoTimestamp), 'MMM d, yyyy · h:mm a');
}

export function BlogPostEditHistoryDialog(props: BlogPostEditHistoryDialogProps): ReactElement {
  const [revisions, setRevisions] = useState<readonly BlogPostRevisionListItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState<boolean>(false);
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null);
  const [revisionDetail, setRevisionDetail] = useState<BlogPostRevisionDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState<boolean>(false);
  const listUrl = buildApiUrl(`/api/admin/blog-posts/${props.postId}/revisions`);

  const executeLoadList = useCallback(async (): Promise<void> => {
    setIsLoadingList(true);
    try {
      const response = await fetch(listUrl);
      const data = (await response.json()) as RevisionsListResponse;
      if (!response.ok || data.revisions === undefined) {
        throw new Error(data.details ?? data.error ?? 'Failed to load edit history.');
      }
      setRevisions(data.revisions);
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to load edit history.');
      setRevisions([]);
    } finally {
      setIsLoadingList(false);
    }
  }, [listUrl]);

  useEffect(() => {
    if (!props.open) {
      setSelectedRevisionId(null);
      setRevisionDetail(null);
      return;
    }
    void executeLoadList();
  }, [executeLoadList, props.open, props.refreshKey]);

  useEffect(() => {
    if (selectedRevisionId === null) {
      setRevisionDetail(null);
      return;
    }
    let isCancelled = false;
    const executeLoadDetail = async (): Promise<void> => {
      setIsLoadingDetail(true);
      try {
        const response = await fetch(
          buildApiUrl(`/api/admin/blog-posts/${props.postId}/revisions/${selectedRevisionId}`),
        );
        const data = (await response.json()) as RevisionDetailResponse;
        if (!response.ok || data.revision === undefined) {
          throw new Error(data.details ?? data.error ?? 'Failed to load revision.');
        }
        if (!isCancelled) {
          setRevisionDetail(data.revision);
        }
      } catch (error: unknown) {
        if (!isCancelled) {
          notifyError(error instanceof Error ? error.message : 'Failed to load revision.');
          setSelectedRevisionId(null);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingDetail(false);
        }
      }
    };
    void executeLoadDetail();
    return () => {
      isCancelled = true;
    };
  }, [props.postId, selectedRevisionId]);

  return (
    <>
      <Dialog open={props.open} onOpenChange={props.onOpenChange}>
        <DialogContent className="flex max-h-[min(85dvh,720px)] max-w-2xl flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="space-y-1 border-b border-border px-6 py-5 text-left">
            <DialogTitle className="flex items-center gap-2 text-base">
              <History className="size-4 text-primary" aria-hidden />
              Edit history
            </DialogTitle>
            <DialogDescription>
              Saved changes only — each entry is recorded when you click Save post.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            {isLoadingList ? (
              <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading history…
              </div>
            ) : revisions.length === 0 ? (
              <p className="px-4 py-16 text-center text-sm text-muted-foreground">
                No saved edits yet. Changes appear here after you save the post.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {revisions.map((revision) => (
                  <li key={revision.id}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 rounded-lg px-4 py-3.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      onClick={() => setSelectedRevisionId(revision.id)}
                    >
                      <div className="min-w-0 flex-1 space-y-2">
                        <p className="text-sm font-medium text-foreground">{formatRevisionSavedAt(revision.savedAtIso)}</p>
                        <p className="text-xs text-muted-foreground">{revision.summary}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {revision.changedFields.map((field) => (
                            <Badge key={field} variant="secondary" className="font-normal">
                              {BLOG_POST_REVISION_FIELD_LABELS[field]}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={selectedRevisionId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedRevisionId(null);
          }
        }}
      >
        <DialogContent
          className={cn(
            'flex max-h-[min(90dvh,840px)] max-w-4xl flex-col gap-0 overflow-hidden p-0',
            'sm:max-w-4xl',
          )}
        >
          <DialogHeader className="shrink-0 space-y-1 border-b border-border px-6 py-5 text-left">
            <DialogTitle className="text-base">Revision details</DialogTitle>
            <DialogDescription>
              {revisionDetail !== null
                ? `Saved ${formatRevisionSavedAt(revisionDetail.savedAtIso)}`
                : 'Comparing previous and saved values'}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {isLoadingDetail ? (
              <div className="flex items-center justify-center gap-2 py-20 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Loading diff…
              </div>
            ) : revisionDetail !== null ? (
              <BlogPostRevisionDiffView revision={revisionDetail} />
            ) : null}
          </div>
          <div className="shrink-0 border-t border-border px-6 py-4">
            <Button type="button" variant="outline" onClick={() => setSelectedRevisionId(null)}>
              Back to list
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
