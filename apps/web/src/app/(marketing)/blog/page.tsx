import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ReactElement } from 'react';
import { MarketingBlogIndex } from '@/components/marketing/blog/marketing-blog-index';
import { listPublishedBlogPostsPage } from '@/lib/data/blog-posts';
import {
  BLOG_LIST_PAGE_SIZE,
  buildBlogListPageHref,
  parseBlogListPageParam,
} from '@/lib/marketing/blog-list-pagination';

export const dynamic = 'force-dynamic';

type BlogIndexPageProps = {
  readonly searchParams: Promise<{ readonly page?: string | string[] }>;
};

export async function generateMetadata(props: BlogIndexPageProps): Promise<Metadata> {
  const { page: pageParam } = await props.searchParams;
  const page = parseBlogListPageParam(pageParam);
  if (page <= 1) {
    return {
      title: 'Blog — TechMD',
      description: 'Technology guidance articles for growing teams in the Philippines.',
    };
  }
  return {
    title: `Blog — Page ${page} — TechMD`,
    description: 'Technology guidance articles for growing teams in the Philippines.',
  };
}

export default async function BlogIndexPage(props: BlogIndexPageProps): Promise<ReactElement> {
  const { page: pageParam } = await props.searchParams;
  const requestedPage = parseBlogListPageParam(pageParam);
  if (requestedPage === 1 && pageParam !== undefined) {
    redirect('/blog');
  }
  const pageResult = await listPublishedBlogPostsPage({
    page: requestedPage,
    pageSize: BLOG_LIST_PAGE_SIZE,
  });
  if (pageResult.totalCount === 0 && requestedPage > 1) {
    redirect('/blog');
  }
  if (pageResult.totalPages > 0 && requestedPage > pageResult.totalPages) {
    redirect(buildBlogListPageHref(pageResult.totalPages));
  }
  return (
    <MarketingBlogIndex
      posts={pageResult.posts}
      page={pageResult.page}
      pageSize={pageResult.pageSize}
      totalCount={pageResult.totalCount}
      totalPages={pageResult.totalPages}
    />
  );
}
