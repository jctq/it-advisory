import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import type { ReactElement } from 'react';
import { Button } from '@/components/ui/button';
import { buildBlogListPageHref, buildBlogListVisiblePageNumbers } from '@/lib/marketing/blog-list-pagination';
import { cn } from '@/lib/utils';

type MarketingBlogPaginationProps = {
  readonly currentPage: number;
  readonly totalPages: number;
};

function BlogPaginationEllipsis(): ReactElement {
  return (
    <span className="inline-flex size-9 items-center justify-center text-sm text-muted-foreground" aria-hidden>
      …
    </span>
  );
}

export function MarketingBlogPagination(props: MarketingBlogPaginationProps): ReactElement | null {
  if (props.totalPages <= 1) {
    return null;
  }
  const visiblePages = buildBlogListVisiblePageNumbers(props.currentPage, props.totalPages);
  const previousPage = props.currentPage > 1 ? props.currentPage - 1 : null;
  const nextPage = props.currentPage < props.totalPages ? props.currentPage + 1 : null;
  return (
    <nav className="mt-8 flex flex-col items-center gap-4" aria-label="Blog pagination">
      <div className="flex flex-wrap items-center justify-center gap-1">
        {previousPage !== null ? (
          <Button variant="outline" size="icon" className="size-9 shrink-0" asChild>
            <Link href={buildBlogListPageHref(previousPage)} aria-label="Previous page">
              <ChevronLeft aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon" className="size-9 shrink-0" disabled aria-label="Previous page">
            <ChevronLeft aria-hidden />
          </Button>
        )}
        {visiblePages.map((pageNumber, index) => {
          const previousVisiblePage = visiblePages[index - 1];
          const showEllipsisBefore =
            previousVisiblePage !== undefined && pageNumber - previousVisiblePage > 1;
          const isCurrentPage = pageNumber === props.currentPage;
          return (
            <span key={pageNumber} className="inline-flex items-center gap-1">
              {showEllipsisBefore ? <BlogPaginationEllipsis /> : null}
              <Button
                variant={isCurrentPage ? 'default' : 'outline'}
                size="icon"
                className={cn('size-9 shrink-0 tabular-nums', isCurrentPage && 'pointer-events-none')}
                asChild={!isCurrentPage}
                aria-current={isCurrentPage ? 'page' : undefined}
              >
                {isCurrentPage ? (
                  <span>{pageNumber}</span>
                ) : (
                  <Link href={buildBlogListPageHref(pageNumber)} aria-label={`Page ${pageNumber}`}>
                    {pageNumber}
                  </Link>
                )}
              </Button>
            </span>
          );
        })}
        {nextPage !== null ? (
          <Button variant="outline" size="icon" className="size-9 shrink-0" asChild>
            <Link href={buildBlogListPageHref(nextPage)} aria-label="Next page">
              <ChevronRight aria-hidden />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="icon" className="size-9 shrink-0" disabled aria-label="Next page">
            <ChevronRight aria-hidden />
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Page {props.currentPage} of {props.totalPages}
      </p>
    </nav>
  );
}
