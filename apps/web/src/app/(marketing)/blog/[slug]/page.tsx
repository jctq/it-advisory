import { format } from 'date-fns';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactElement } from 'react';
import { MarketingBlogProse } from '@/components/marketing/blog/marketing-blog-prose';
import { resolveBlogPostOpenGraphImageUrl } from '@/lib/blog-post-cover-image';
import {
  getBlogPostDisplayTitle,
  getBlogPostSeoDescription,
  getBlogPostSeoTitle,
  parseBlogPostSeoKeywords,
} from '@/lib/blog-post-types';
import { findPublishedBlogPostBySlug } from '@/lib/data/blog-posts';
import { buildMarketingMetadataAsync } from '@/lib/seo/site-seo';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type BlogArticlePageProps = {
  readonly params: Promise<{ readonly slug: string }>;
};

export async function generateMetadata(props: BlogArticlePageProps) {
  const { slug } = await props.params;
  const post = await findPublishedBlogPostBySlug(slug);
  if (post === null) {
    return buildMarketingMetadataAsync({
      title: 'Article not found — TeqMD',
      description: 'This article could not be found.',
      pathname: `/blog/${slug}`,
    });
  }
  const seoTitle = getBlogPostSeoTitle(post);
  const seoKeywords = parseBlogPostSeoKeywords(post);
  return buildMarketingMetadataAsync({
    title: `${seoTitle} — TeqMD Blog`,
    description: getBlogPostSeoDescription(post),
    pathname: `/blog/${slug}`,
    openGraphType: 'article',
    openGraphImageUrl: resolveBlogPostOpenGraphImageUrl(post),
    ...(seoKeywords.length > 0 ? { keywords: seoKeywords } : {}),
  });
}

export default async function BlogArticlePage(props: BlogArticlePageProps): Promise<ReactElement> {
  const { slug } = await props.params;
  const post = await findPublishedBlogPostBySlug(slug);
  if (post === null) {
    notFound();
  }
  const title = getBlogPostDisplayTitle(post);
  const publishedLabel =
    post.publishedAtIso !== null
      ? format(new Date(post.publishedAtIso), 'MMMM d, yyyy')
      : format(new Date(post.updatedAtIso), 'MMMM d, yyyy');
  return (
    <main className="mx-auto max-w-6xl px-6 py-16">
      <div className="mx-auto">
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">
          <Link href="/blog" className="hover:underline">
            Blog
          </Link>
        </p>
        {post.showTitle ? (
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        ) : null}
        {(post.description?.trim().length ?? 0) > 0 ? (
          <p className={cn('text-sm leading-relaxed text-muted-foreground', post.showTitle ? 'mt-3' : 'mt-2')}>
            {post.description?.trim()}
          </p>
        ) : null}
        <time
          className={cn(
            'block text-sm text-muted-foreground',
            post.showTitle || (post.description?.trim().length ?? 0) > 0 ? 'mt-3' : 'mt-2',
          )}
          dateTime={post.publishedAtIso ?? post.updatedAtIso}
        >
          {publishedLabel}
        </time>
        <div className={cn('rounded-xl border border-border bg-card p-6 shadow-sm md:p-8', post.showTitle ? 'mt-10' : 'mt-6')}>
          <MarketingBlogProse contentMarkdown={post.contentMarkdown} />
        </div>
        <p className="mt-8 text-center text-xs text-muted-foreground">
          <Link href="/blog" className="font-medium text-primary underline-offset-2 hover:underline">
            All articles
          </Link>
          {' · '}
          <Link href="/" className="text-primary underline-offset-2 hover:underline">
            Back to home
          </Link>
        </p>
      </div>
    </main>
  );
}
