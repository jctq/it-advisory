'use client';

import { ArrowLeft, Circle, ExternalLink, History, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState, type ReactElement } from 'react';
import { AdminBlogMarkdownEditor } from '@/components/admin/admin-blog-markdown-editor';
import { BlogPostEditHistoryDialog } from '@/components/admin/blog-post-edit-history-dialog';
import { BlogPostEditorSidebar } from '@/components/admin/blog-post-editor-sidebar';
import {
  AdminFormStickyFooter,
  adminFormStickyFooterScrollPaddingClass,
} from '@/components/admin/admin-form-sticky-footer';
import { MarketingBlogProse } from '@/components/marketing/blog/marketing-blog-prose';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { buildApiUrl } from '@/lib/config/build-api-url';
import { slugifyBlogPostTitle, type BlogPostValue } from '@/lib/blog-post-types';
import { notifyError, notifySuccess } from '@/lib/notify';
import { cn } from '@/lib/utils';

type BlogPostEditorProps = {
  readonly initialPost: BlogPostValue;
};

type BlogPostApiResponse = {
  readonly post?: BlogPostValue;
  readonly error?: string;
  readonly details?: string;
};

export function BlogPostEditor(props: BlogPostEditorProps): ReactElement {
  const [post, setPost] = useState<BlogPostValue>(props.initialPost);
  const [title, setTitle] = useState<string>(props.initialPost.title ?? '');
  const [description, setDescription] = useState<string>(props.initialPost.description ?? '');
  const [slug, setSlug] = useState<string>(props.initialPost.slug);
  const [contentMarkdown, setContentMarkdown] = useState<string>(props.initialPost.contentMarkdown);
  const [status, setStatus] = useState<BlogPostValue['status']>(props.initialPost.status);
  const [showInBlogList, setShowInBlogList] = useState<boolean>(props.initialPost.showInBlogList);
  const [showTitle, setShowTitle] = useState<boolean>(props.initialPost.showTitle);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasCopiedEmbedId, setHasCopiedEmbedId] = useState<boolean>(false);
  const [editorRevision, setEditorRevision] = useState<number>(0);
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [historyRefreshKey, setHistoryRefreshKey] = useState<number>(0);
  const apiUrl = useMemo(() => buildApiUrl(`/api/admin/blog-posts/${post.id}`), [post.id]);
  const editorKey = useMemo(() => `${post.id}-${editorRevision}`, [editorRevision, post.id]);
  const displayTitle = title.trim().length > 0 ? title.trim() : 'Untitled post';
  const isDirty = useMemo(
    () =>
      (title.trim().length > 0 ? title.trim() : null) !== post.title ||
      (description.trim().length > 0 ? description.trim() : null) !== post.description ||
      slug !== post.slug ||
      contentMarkdown !== post.contentMarkdown ||
      status !== post.status ||
      showInBlogList !== post.showInBlogList ||
      showTitle !== post.showTitle,
    [contentMarkdown, description, post, showInBlogList, showTitle, slug, status, title],
  );

  const executeReset = useCallback((): void => {
    setTitle(post.title ?? '');
    setDescription(post.description ?? '');
    setSlug(post.slug);
    setContentMarkdown(post.contentMarkdown);
    setStatus(post.status);
    setShowInBlogList(post.showInBlogList);
    setShowTitle(post.showTitle);
    setEditorRevision((current) => current + 1);
  }, [post]);

  const executeRegenerateSlug = useCallback((): void => {
    setSlug(slugifyBlogPostTitle(title.trim().length > 0 ? title : null));
  }, [title]);

  const executeCopyEmbedId = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(post.id);
      setHasCopiedEmbedId(true);
      notifySuccess('Embed id copied.');
      window.setTimeout(() => setHasCopiedEmbedId(false), 2000);
    } catch {
      notifyError('Could not copy embed id.');
    }
  }, [post.id]);

  const executeSave = useCallback(async (): Promise<void> => {
    setIsSaving(true);
    try {
      const response = await fetch(apiUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim().length > 0 ? title.trim() : null,
          description: description.trim().length > 0 ? description.trim() : null,
          slug,
          contentMarkdown,
          status,
          showInBlogList,
          showTitle,
        }),
      });
      const data = (await response.json()) as BlogPostApiResponse;
      if (!response.ok || data.post === undefined) {
        throw new Error(data.details ?? data.error ?? 'Failed to save blog post.');
      }
      setPost(data.post);
      setTitle(data.post.title ?? '');
      setDescription(data.post.description ?? '');
      setSlug(data.post.slug);
      setContentMarkdown(data.post.contentMarkdown);
      setStatus(data.post.status);
      setShowInBlogList(data.post.showInBlogList);
      setShowTitle(data.post.showTitle);
      setHistoryRefreshKey((current) => current + 1);
      notifySuccess('Blog post saved.');
    } catch (error: unknown) {
      notifyError(error instanceof Error ? error.message : 'Failed to save blog post.');
    } finally {
      setIsSaving(false);
    }
  }, [apiUrl, contentMarkdown, description, showInBlogList, showTitle, slug, status, title]);

  const publicPreviewHref = status === 'published' ? `/blog/${slug}` : null;

  return (
    <section className="mx-auto flex min-h-0 w-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Button type="button" variant="ghost" size="sm" className="gap-2" asChild>
            <Link href="/admin/blog-posts">
              <ArrowLeft className="size-4" aria-hidden />
              Posts
            </Link>
          </Button>
          <div className="hidden h-5 w-px bg-border sm:block" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">Blog editor</p>
            <h1 className="truncate text-base font-semibold text-foreground sm:text-lg">{displayTitle}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isDirty ? (
              <Badge variant="outline" className="gap-1 border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200">
                <Circle className="size-1.5 fill-current" aria-hidden />
                Unsaved
              </Badge>
            ) : (
              <Badge variant="secondary">Saved</Badge>
            )}
            <Badge variant={status === 'published' ? 'default' : 'outline'}>
              {status === 'published' ? 'Published' : 'Draft'}
            </Badge>
            <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => setIsHistoryOpen(true)}>
              <History className="size-4" aria-hidden />
              History
            </Button>
            {publicPreviewHref !== null ? (
              <Button type="button" variant="outline" size="sm" className="gap-2" asChild>
                <Link href={publicPreviewHref} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-4" aria-hidden />
                  View live
                </Link>
              </Button>
            ) : null}
          </div>
        </div>
      </header>
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col gap-6 px-4 py-6 lg:flex-row lg:items-stretch lg:px-6',
          adminFormStickyFooterScrollPaddingClass,
        )}
      >
        <BlogPostEditorSidebar
          post={post}
          title={title}
          description={description}
          slug={slug}
          status={status}
          showInBlogList={showInBlogList}
          showTitle={showTitle}
          hasCopiedEmbedId={hasCopiedEmbedId}
          onTitleChange={setTitle}
          onDescriptionChange={setDescription}
          onSlugChange={setSlug}
          onStatusChange={setStatus}
          onShowInBlogListChange={setShowInBlogList}
          onShowTitleChange={setShowTitle}
          onRegenerateSlug={executeRegenerateSlug}
          onCopyEmbedId={() => void executeCopyEmbedId()}
        />
        <div className="flex min-h-80 min-w-0 flex-1 flex-col lg:min-h-0">
          <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            <Tabs defaultValue="edit" className="grid min-h-0 flex-1 grid-rows-[auto_minmax(0,1fr)]">
              <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <TabsList className="h-9">
                  <TabsTrigger value="edit" className="min-w-18">
                    Write
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="min-w-18">
                    Preview
                  </TabsTrigger>
                </TabsList>
                <p className="text-xs text-muted-foreground">
                  <span className="text-foreground/80">Rich text</span> and{' '}
                  <span className="text-foreground/80">Source</span> stay in sync when you switch. Paste long posts in
                  Source. Images: JPEG, PNG, GIF, WebP (max 5 MB) · <span className="text-foreground/80">Shift+Enter</span>{' '}
                  for a line break
                </p>
              </div>
              <TabsContent
                value="edit"
                className="mt-0 row-start-2 min-h-0 overflow-hidden focus-visible:outline-none data-[state=inactive]:hidden"
              >
                <AdminBlogMarkdownEditor
                  editorKey={editorKey}
                  markdown={contentMarkdown}
                  onMarkdownChange={setContentMarkdown}
                />
              </TabsContent>
              <TabsContent
                value="preview"
                className="mt-0 row-start-2 min-h-0 overflow-y-auto focus-visible:outline-none data-[state=inactive]:hidden"
              >
                <div className="p-6 sm:p-8">
                  {contentMarkdown.trim().length > 0 ? (
                    <article className="mx-auto space-y-4">
                      {showTitle && title.trim().length > 0 ? (
                        <h2 className="text-2xl font-semibold tracking-tight text-foreground">{title.trim()}</h2>
                      ) : null}
                      {description.trim().length > 0 ? (
                        <p className="text-sm leading-relaxed text-muted-foreground">{description.trim()}</p>
                      ) : null}
                      <MarketingBlogProse contentMarkdown={contentMarkdown} />
                    </article>
                  ) : (
                    <div className="flex min-h-[240px] flex-col items-center justify-center gap-2 text-center">
                      <p className="text-sm font-medium text-foreground">Nothing to preview</p>
                      <p className="max-w-sm text-xs text-muted-foreground">Add content in the Write tab, then switch here to see how it will look on the site.</p>
                    </div>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>
      {isSaving ? (
        <div
          className={cn(
            'pointer-events-none fixed bottom-24 right-6 z-40 flex items-center gap-2 rounded-full border border-border',
            'bg-background/95 px-3 py-2 text-xs text-muted-foreground shadow-lg backdrop-blur-sm',
          )}
          aria-live="polite"
        >
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Saving…
        </div>
      ) : null}
      <AdminFormStickyFooter
        isSaving={isSaving}
        isDisabled={!isDirty || isSaving}
        onSave={() => void executeSave()}
        onReset={executeReset}
        isResetDisabled={!isDirty || isSaving}
      />
      <BlogPostEditHistoryDialog
        postId={post.id}
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        refreshKey={historyRefreshKey}
      />
    </section>
  );
}
