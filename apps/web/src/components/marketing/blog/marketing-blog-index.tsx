import { Newspaper } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { MarketingBlogPagination } from '@/components/marketing/blog/marketing-blog-pagination';
import { MarketingBlogPostCard } from '@/components/marketing/blog/marketing-blog-post-card';
import { MarketingSectionHeader } from '@/components/marketing/marketing-section-header';
import type { BlogPostValue } from '@/lib/blog-post-types';
import { buildBlogListResultRangeLabel } from '@/lib/marketing/blog-list-pagination';

type MarketingBlogIndexProps = {
  readonly posts: readonly BlogPostValue[];
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
  readonly totalPages: number;
};

export function MarketingBlogIndex(props: MarketingBlogIndexProps): ReactElement {
  const rangeLabel = buildBlogListResultRangeLabel({
    page: props.page,
    pageSize: props.pageSize,
    totalCount: props.totalCount,
  });
  const showFeaturedPost = props.page === 1 && props.posts.length > 0;
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:py-16 lg:py-20">
      <div className="mx-auto">
        <MarketingSectionHeader
          eyebrow="Resources"
          title="Blog"
          description="Practical technology guidance for teams in the Philippines — diagnostics, tooling, and delivery."
        />
        {props.totalCount === 0 ? (
          <div
            className="mt-10 flex flex-col items-center rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center"
            role="status"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Newspaper className="size-6 text-muted-foreground" aria-hidden />
            </div>
            <p className="mt-4 text-base font-medium text-foreground">No articles yet</p>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
              We are preparing guides on diagnostics, tooling, and delivery. Check back soon or return to the homepage.
            </p>
            <Link
              href="/"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Back to home
            </Link>
          </div>
        ) : (
          <>
            <p className="mt-8 text-sm text-muted-foreground" aria-live="polite">
              {rangeLabel}
            </p>
            <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
              <ul className="divide-y divide-border">
                {props.posts.map((post, index) => (
                  <li key={post.id}>
                    <MarketingBlogPostCard
                      post={post}
                      variant={showFeaturedPost && index === 0 ? 'featured' : 'default'}
                    />
                  </li>
                ))}
              </ul>
            </div>
            <MarketingBlogPagination currentPage={props.page} totalPages={props.totalPages} />
          </>
        )}
        {props.totalCount > 0 ? (
          <nav
            className="mt-10 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 border-t border-border pt-8 text-sm text-muted-foreground"
            aria-label="Blog page footer"
          >
            <Link href="/" className="font-medium text-primary underline-offset-2 hover:underline">
              Back to home
            </Link>
          </nav>
        ) : null}
      </div>
    </main>
  );
}
