export const BLOG_LIST_PAGE_SIZE = 10;

export function parseBlogListPageParam(value: string | string[] | undefined): number {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsedValue = Number.parseInt(rawValue ?? '1', 10);
  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return 1;
  }
  return parsedValue;
}

export function buildBlogListPageHref(page: number): string {
  if (page <= 1) {
    return '/blog';
  }
  return `/blog?page=${page}`;
}

export function buildBlogListResultRangeLabel(input: {
  readonly page: number;
  readonly pageSize: number;
  readonly totalCount: number;
}): string {
  if (input.totalCount === 0) {
    return 'No articles';
  }
  const startIndex = (input.page - 1) * input.pageSize + 1;
  const endIndex = Math.min(input.page * input.pageSize, input.totalCount);
  return `Showing ${startIndex}–${endIndex} of ${input.totalCount} article${input.totalCount === 1 ? '' : 's'}`;
}

export function buildBlogListVisiblePageNumbers(currentPage: number, totalPages: number): readonly number[] {
  if (totalPages <= 1) {
    return currentPage === 1 ? [1] : [];
  }
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const pageNumbers = new Set<number>([1, totalPages, currentPage, currentPage - 1, currentPage + 1]);
  return [...pageNumbers].filter((page) => page >= 1 && page <= totalPages).sort((left, right) => left - right);
}
