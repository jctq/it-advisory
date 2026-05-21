'use client';

import dynamic from 'next/dynamic';
import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

const AdminBlogMdxEditor = dynamic(
  async () => {
    const editorModule = await import('@/components/admin/admin-blog-mdx-editor-inner');
    return editorModule.AdminBlogMdxEditorInner;
  },
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 text-sm text-muted-foreground">
        Loading editor…
      </div>
    ),
  },
);

type AdminBlogMarkdownEditorProps = {
  readonly markdown: string;
  readonly onMarkdownChange: (markdown: string) => void;
  readonly editorKey: string;
  readonly className?: string;
};

export function AdminBlogMarkdownEditor(props: AdminBlogMarkdownEditorProps): ReactElement {
  return (
    <div className={cn('admin-blog-editor-shell relative min-h-0 size-full', props.className)}>
      <div className="absolute inset-0 overflow-hidden rounded-lg border border-border bg-card">
        <AdminBlogMdxEditor
          key={props.editorKey}
          markdown={props.markdown}
          onMarkdownChange={props.onMarkdownChange}
        />
      </div>
    </div>
  );
}
