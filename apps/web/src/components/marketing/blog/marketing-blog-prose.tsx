'use client';

import { Streamdown } from 'streamdown';
import { useMemo, type ComponentProps, type ReactElement } from 'react';
import remarkBreaks from 'remark-breaks';
import { normalizeBlogContentMarkdown } from '@/lib/blog-markdown-normalize';
import { cn } from '@/lib/utils';

/** Blocked if raw HTML in CMS markdown slips past sanitization. */
const DISALLOWED_MARKDOWN_ELEMENTS = ['script', 'style', 'iframe'] as const;

const BLOG_PROSE_STREAMDOWN_COMPONENTS = {
  /** Streamdown's default image wrapper uses a div, which is invalid inside <p>. */
  img: function BlogProseImage(props: ComponentProps<'img'>): ReactElement | null {
    const rawSource = props.src;
    const source = typeof rawSource === 'string' ? rawSource.trim() : '';
    if (source.length === 0) {
      return null;
    }
    return (
      // eslint-disable-next-line @next/next/no-img-element -- CMS-hosted URLs from our upload API
      <img
        src={source}
        alt={props.alt ?? ''}
        className={cn(
          'my-4 h-auto max-w-full rounded-lg border border-border',
          props.className,
        )}
        loading="lazy"
        decoding="async"
      />
    );
  },
  /** Use div instead of p so block images and other block content are valid HTML. */
  p: function BlogProseParagraph(props: ComponentProps<'div'>): ReactElement {
    const { className, children, ...rest } = props;
    return (
      <div data-blog-prose-block="" className={cn('my-2', className)} {...rest}>
        {children}
      </div>
    );
  },
};

type MarketingBlogProseProps = {
  readonly contentMarkdown: string;
  readonly className?: string;
};

/**
 * Renders CMS markdown with the same typography as public blog articles.
 */
export function MarketingBlogProse(props: MarketingBlogProseProps): ReactElement {
  const streamdownComponents = useMemo(() => BLOG_PROSE_STREAMDOWN_COMPONENTS, []);
  const contentMarkdown = useMemo(
    () => normalizeBlogContentMarkdown(props.contentMarkdown),
    [props.contentMarkdown],
  );
  return (
    <Streamdown
      mode="static"
      remarkPlugins={[remarkBreaks]}
      disallowedElements={[...DISALLOWED_MARKDOWN_ELEMENTS]}
      components={streamdownComponents}
      className={cn(
        'space-y-4 text-sm leading-relaxed text-muted-foreground',
        '[&_h1]:mt-4 [&_h1]:text-2xl [&_h1]:font-semibold [&_h1]:text-foreground',
        '[&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:tracking-tight',
        '[&_h3]:mt-4 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-foreground',
        '[&_[data-blog-prose-block]]:my-2 [&_[data-blog-prose-block]+[data-blog-prose-block]]:mt-4',
        '[&_br]:block',
        '[&_ul]:my-2 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5',
        '[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:space-y-1 [&_ol]:pl-5',
        '[&_li]:my-0.5',
        '[&_a]:font-medium [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2',
        '[&_strong]:font-semibold [&_strong]:text-foreground',
        '[&_em]:italic',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4 [&_blockquote]:text-muted-foreground',
        '[&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em]',
        '[&_pre]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-md [&_pre]:border [&_pre]:bg-muted [&_pre]:p-3',
        '[&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_hr]:my-6 [&_hr]:border-border',
        '[&_img]:my-4 [&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-lg [&_img]:border [&_img]:border-border',
        '[&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs',
        '[&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:font-semibold [&_th]:text-foreground',
        '[&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1',
        props.className,
      )}
    >
      {contentMarkdown}
    </Streamdown>
  );
}
