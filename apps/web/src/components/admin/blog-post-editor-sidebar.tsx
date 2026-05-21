'use client';

import { format } from 'date-fns';
import { Copy, RefreshCw } from 'lucide-react';
import type { ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Textarea } from '@/components/ui/textarea';
import type { BlogPostValue } from '@/lib/blog-post-types';
import { cn } from '@/lib/utils';

function formatAdminDateTime(isoTimestamp: string | null): string {
  if (isoTimestamp === null) {
    return '—';
  }
  return format(new Date(isoTimestamp), 'MMM d, yyyy · h:mm a');
}

function EditorSection(props: {
  readonly title: string;
  readonly description?: string;
  readonly children: React.ReactNode;
  readonly className?: string;
}): ReactElement {
  return (
    <section className={cn('rounded-xl border border-border bg-card shadow-sm', props.className)}>
      <div className="border-b border-border/80 px-4 py-3">
        <h2 className="text-sm font-semibold text-foreground">{props.title}</h2>
        {props.description !== undefined ? (
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{props.description}</p>
        ) : null}
      </div>
      <div className="space-y-4 p-4">{props.children}</div>
    </section>
  );
}

function ToggleRow(props: {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly checked: boolean;
  readonly onCheckedChange: (checked: boolean) => void;
}): ReactElement {
  return (
    <label
      htmlFor={props.id}
      className="flex cursor-pointer items-start gap-3 rounded-lg border border-border/80 bg-muted/15 p-3 transition-colors hover:bg-muted/25"
    >
      <input
        id={props.id}
        type="checkbox"
        checked={props.checked}
        onChange={(event) => props.onCheckedChange(event.target.checked)}
        className="mt-0.5 size-4 rounded border-input"
      />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-foreground">{props.label}</span>
        <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{props.description}</span>
      </span>
    </label>
  );
}

export type BlogPostEditorSidebarProps = {
  readonly post: BlogPostValue;
  readonly title: string;
  readonly description: string;
  readonly slug: string;
  readonly status: BlogPostValue['status'];
  readonly showInBlogList: boolean;
  readonly showTitle: boolean;
  readonly hasCopiedEmbedId: boolean;
  readonly onTitleChange: (value: string) => void;
  readonly onDescriptionChange: (value: string) => void;
  readonly onSlugChange: (value: string) => void;
  readonly onStatusChange: (value: BlogPostValue['status']) => void;
  readonly onShowInBlogListChange: (checked: boolean) => void;
  readonly onShowTitleChange: (checked: boolean) => void;
  readonly onRegenerateSlug: () => void;
  readonly onCopyEmbedId: () => void;
};

export function BlogPostEditorSidebar(props: BlogPostEditorSidebarProps): ReactElement {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-4 lg:w-[min(100%,20rem)] xl:w-80">
      <EditorSection title="Article" description="Title and summary shown on the marketing site.">
        <div className="space-y-2">
          <Label htmlFor="blog-title">Title</Label>
          <Input
            id="blog-title"
            value={props.title}
            onChange={(event) => props.onTitleChange(event.target.value)}
            placeholder="Optional display title"
            maxLength={200}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="blog-description">Description</Label>
          <Textarea
            id="blog-description"
            value={props.description}
            onChange={(event) => props.onDescriptionChange(event.target.value)}
            placeholder="Short summary under the title"
            maxLength={500}
            rows={3}
            className="min-h-[4.5rem] resize-y"
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="blog-slug">URL slug</Label>
            <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs" onClick={props.onRegenerateSlug}>
              <RefreshCw className="size-3" aria-hidden />
              From title
            </Button>
          </div>
          <Input
            id="blog-slug"
            value={props.slug}
            onChange={(event) => props.onSlugChange(event.target.value)}
            placeholder="url-friendly-slug"
            maxLength={120}
            className="font-mono text-sm"
          />
          <p className="text-xs text-muted-foreground">
            /blog/<span className="font-mono text-foreground">{props.slug || '…'}</span>
          </p>
        </div>
      </EditorSection>
      <EditorSection title="Publishing">
        <div className="space-y-2">
          <Label htmlFor="blog-status">Status</Label>
          <NativeSelect
            id="blog-status"
            value={props.status}
            onChange={(event) => props.onStatusChange(event.target.value as BlogPostValue['status'])}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </NativeSelect>
        </div>
        <ToggleRow
          id="blog-show-in-list"
          label="Show on blog index"
          description="List on /blog when published. Off = direct URL and embed only."
          checked={props.showInBlogList}
          onCheckedChange={props.onShowInBlogListChange}
        />
        <ToggleRow
          id="blog-show-title"
          label="Show title"
          description="Display title on article, index cards, and embeds."
          checked={props.showTitle}
          onCheckedChange={props.onShowTitleChange}
        />
      </EditorSection>
      <EditorSection title="Details">
        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Created</dt>
            <dd className="text-right tabular-nums text-foreground">{formatAdminDateTime(props.post.createdAtIso)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Updated</dt>
            <dd className="text-right tabular-nums text-foreground">{formatAdminDateTime(props.post.updatedAtIso)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Published</dt>
            <dd className="text-right tabular-nums text-foreground">{formatAdminDateTime(props.post.publishedAtIso)}</dd>
          </div>
        </dl>
        <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs">Embed id</Label>
            <Badge variant="outline" className="font-normal">
              CMS embed
            </Badge>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Paste into env vars or <code className="rounded bg-muted px-1 font-mono text-[11px]">BlogPostEmbed</code>.
          </p>
          <div className="flex gap-2">
            <Input readOnly value={props.post.id} className="h-9 font-mono text-[11px]" aria-label="Embed id" />
            <Button type="button" variant="outline" size="icon" className="shrink-0" onClick={props.onCopyEmbedId} aria-label="Copy embed id">
              <Copy className="size-4" aria-hidden />
            </Button>
          </div>
          {props.hasCopiedEmbedId ? <p className="text-xs font-medium text-primary">Copied to clipboard</p> : null}
        </div>
      </EditorSection>
    </aside>
  );
}
