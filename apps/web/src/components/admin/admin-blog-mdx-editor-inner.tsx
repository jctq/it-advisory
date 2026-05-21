'use client';

import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  DiffSourceToggleWrapper,
  diffSourcePlugin,
  headingsPlugin,
  imagePlugin,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  tablePlugin,
  thematicBreakPlugin,
  toolbarPlugin,
  UndoRedo,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { useCallback, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { AdminBlogImageDialog } from '@/components/admin/admin-blog-image-dialog';
import { blogEditorViewSyncPlugin } from '@/lib/admin-blog-editor-sync-plugin';
import { blogPostEditorToMarkdownOptions } from '@/lib/blog-markdown-spacing';
import { normalizeBlogContentMarkdown } from '@/lib/blog-markdown-normalize';
import { uploadBlogImage } from '@/lib/blog-image-upload';
import { notifyError } from '@/lib/notify';

type AdminBlogMdxEditorInnerProps = {
  readonly markdown: string;
  readonly onMarkdownChange: (markdown: string) => void;
};

export function AdminBlogMdxEditorInner(props: AdminBlogMdxEditorInnerProps): ReactElement {
  const overlayHostRef = useRef<HTMLDivElement | null>(null);
  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
  const executeMarkdownChange = useCallback(
    (markdown: string): void => {
      props.onMarkdownChange(normalizeBlogContentMarkdown(markdown));
    },
    [props.onMarkdownChange],
  );
  const executeImageUpload = useCallback(async (file: File): Promise<string> => {
    try {
      return await uploadBlogImage(file);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to upload image.';
      notifyError(message);
      throw error;
    }
  }, []);
  useLayoutEffect(() => {
    if (overlayHostRef.current !== null) {
      setOverlayHost(overlayHostRef.current);
    }
  }, []);
  return (
    <div
      ref={overlayHostRef}
      className="admin-blog-mdx-editor-overlay absolute inset-0 isolate flex flex-col overflow-hidden p-2"
    >
      {overlayHost === null ? (
        <div className="flex size-full items-center justify-center text-sm text-muted-foreground">
          Loading editor…
        </div>
      ) : (
        <MDXEditor
          className="admin-blog-mdx-editor dark-theme flex size-full min-h-0 flex-col overflow-hidden"
          overlayContainer={overlayHost}
          markdown={normalizeBlogContentMarkdown(props.markdown)}
          onChange={executeMarkdownChange}
          toMarkdownOptions={blogPostEditorToMarkdownOptions}
          contentEditableClassName="admin-blog-mdx-editor-content min-h-0 flex-1 px-4 py-3 text-foreground focus:outline-none [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:text-foreground [&_p]:my-2 [&_p]:text-foreground [&_p+p]:mt-4 [&_a]:text-primary [&_strong]:text-foreground"
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            linkPlugin(),
            tablePlugin(),
            thematicBreakPlugin(),
            imagePlugin({
              imageUploadHandler: executeImageUpload,
              ImageDialog: AdminBlogImageDialog,
            }),
            markdownShortcutPlugin(),
            diffSourcePlugin(),
            blogEditorViewSyncPlugin({ onMarkdownSync: executeMarkdownChange }),
            toolbarPlugin({
              toolbarContents: () => (
                <DiffSourceToggleWrapper options={['rich-text', 'source']}>
                  <UndoRedo />
                  <BoldItalicUnderlineToggles />
                  <BlockTypeSelect />
                  <ListsToggle />
                  <CreateLink />
                  <InsertImage />
                  <InsertTable />
                  <InsertThematicBreak />
                </DiffSourceToggleWrapper>
              ),
            }),
          ]}
        />
      )}
    </div>
  );
}
