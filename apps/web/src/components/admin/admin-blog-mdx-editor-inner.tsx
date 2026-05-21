'use client';

import {
  BlockTypeSelect,
  BoldItalicUnderlineToggles,
  CreateLink,
  headingsPlugin,
  imagePlugin,
  InsertImage,
  InsertThematicBreak,
  linkPlugin,
  listsPlugin,
  ListsToggle,
  markdownShortcutPlugin,
  MDXEditor,
  quotePlugin,
  toolbarPlugin,
  UndoRedo,
} from '@mdxeditor/editor';
import '@mdxeditor/editor/style.css';
import { useCallback, useLayoutEffect, useRef, useState, type ReactElement } from 'react';
import { AdminBlogImageDialog } from '@/components/admin/admin-blog-image-dialog';
import { blogPostEditorToMarkdownOptions } from '@/lib/blog-markdown-spacing';
import { uploadBlogImage } from '@/lib/blog-image-upload';
import { notifyError } from '@/lib/notify';

type AdminBlogMdxEditorInnerProps = {
  readonly markdown: string;
  readonly onMarkdownChange: (markdown: string) => void;
};

export function AdminBlogMdxEditorInner(props: AdminBlogMdxEditorInnerProps): ReactElement {
  const overlayHostRef = useRef<HTMLDivElement | null>(null);
  const [overlayHost, setOverlayHost] = useState<HTMLDivElement | null>(null);
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
    <div ref={overlayHostRef} className="admin-blog-mdx-editor-overlay relative isolate p-2">
      {overlayHost === null ? (
        <div className="flex min-h-[280px] items-center justify-center text-sm text-muted-foreground">
          Loading editor…
        </div>
      ) : (
        <MDXEditor
          className="admin-blog-mdx-editor dark-theme"
          overlayContainer={overlayHost}
          markdown={props.markdown}
          onChange={props.onMarkdownChange}
          toMarkdownOptions={blogPostEditorToMarkdownOptions}
          contentEditableClassName="admin-blog-mdx-editor-content min-h-[280px] px-4 py-3 text-foreground focus:outline-none [&_h1]:text-xl [&_h1]:font-semibold [&_h1]:text-foreground [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground [&_li]:text-foreground [&_p]:my-2 [&_p]:text-foreground [&_p+p]:mt-4 [&_a]:text-primary [&_strong]:text-foreground"
          plugins={[
            headingsPlugin(),
            listsPlugin(),
            quotePlugin(),
            linkPlugin(),
            imagePlugin({
              imageUploadHandler: executeImageUpload,
              ImageDialog: AdminBlogImageDialog,
            }),
            markdownShortcutPlugin(),
            toolbarPlugin({
              toolbarContents: () => (
                <>
                  <UndoRedo />
                  <BoldItalicUnderlineToggles />
                  <BlockTypeSelect />
                  <ListsToggle />
                  <CreateLink />
                  <InsertImage />
                  <InsertThematicBreak />
                </>
              ),
            }),
          ]}
        />
      )}
    </div>
  );
}
