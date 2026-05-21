import { format } from 'date-fns';
import { ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { Badge } from '@/components/ui/badge';
import { extractBlogPostCoverImageUrl } from '@/lib/blog-post-cover-image';
import { getBlogPostDisplayTitle, getBlogPostSummary, type BlogPostValue } from '@/lib/blog-post-types';
import { cn } from '@/lib/utils';

type MarketingBlogPostCardProps = {
  readonly post: BlogPostValue;
  readonly variant?: 'default' | 'featured';
};

function formatBlogPostDateLabel(post: BlogPostValue): string {
  const isoTimestamp = post.publishedAtIso ?? post.updatedAtIso;
  return format(new Date(isoTimestamp), 'MMMM d, yyyy');
}

type BlogPostCardThumbnailProps = {
  readonly coverImageUrl: string;
  readonly isFeatured: boolean;
};

function BlogPostCardThumbnail(props: BlogPostCardThumbnailProps): ReactElement {
  return (
    <div
      className={cn(
        'relative shrink-0 overflow-hidden rounded-lg bg-muted/50 ring-1 ring-border/60',
        props.isFeatured ? 'h-20 w-28 sm:h-24 sm:w-36' : 'h-16 w-24 sm:h-18 sm:w-32',
      )}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={props.coverImageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className="size-full object-cover transition-transform duration-200 motion-safe:group-hover:scale-[1.02]"
      />
    </div>
  );
}

export function MarketingBlogPostCard(props: MarketingBlogPostCardProps): ReactElement {
  const variant = props.variant ?? 'default';
  const isFeatured = variant === 'featured';
  const title = getBlogPostDisplayTitle(props.post);
  const summary = getBlogPostSummary(props.post, isFeatured ? 200 : 140);
  const coverImageUrl = extractBlogPostCoverImageUrl(props.post.contentMarkdown);
  const publishedLabel = formatBlogPostDateLabel(props.post);
  const dateTime = props.post.publishedAtIso ?? props.post.updatedAtIso;
  const articleHref = `/blog/${props.post.slug}`;
  return (
    <article className={cn(isFeatured && 'rounded-xl bg-muted/20 px-1 py-1 sm:px-2')}>
      <Link
        href={articleHref}
        className={cn(
          'group flex min-h-11 gap-4 rounded-lg p-3 transition-colors sm:p-4',
          'hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50',
          coverImageUrl === null ? 'items-start' : 'items-center sm:items-start',
        )}
      >
        {coverImageUrl !== null ? (
          <BlogPostCardThumbnail coverImageUrl={coverImageUrl} isFeatured={isFeatured} />
        ) : null}
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <time className="text-xs font-medium text-muted-foreground" dateTime={dateTime}>
              {publishedLabel}
            </time>
            {isFeatured ? (
              <Badge variant="secondary" className="h-5 px-2 text-[0.625rem] font-semibold uppercase tracking-wide">
                Latest
              </Badge>
            ) : null}
          </div>
          {props.post.showTitle ? (
            <h2
              className={cn(
                'text-balance font-semibold leading-snug tracking-tight text-foreground transition-colors group-hover:text-primary',
                isFeatured ? 'text-lg sm:text-xl' : 'text-base sm:text-lg',
              )}
            >
              {title}
            </h2>
          ) : (
            <h2 className="sr-only">{title}</h2>
          )}
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">{summary}</p>
          <span className="inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary sm:min-h-0">
            Read article
            <ArrowRight
              className="size-4 shrink-0 transition-transform duration-200 motion-safe:group-hover:translate-x-0.5"
              aria-hidden
            />
          </span>
        </div>
      </Link>
    </article>
  );
}
