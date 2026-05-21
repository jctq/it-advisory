import type { MetadataRoute } from 'next';
import { listPublishedBlogPosts } from '@/lib/data/blog-posts';
import { resolveConfiguredAppOrigin } from '@/lib/config/app-origin';
import { BLOG_LIST_PAGE_SIZE, buildBlogListPageHref } from '@/lib/marketing/blog-list-pagination';

const STATIC_MARKETING_PATHS: readonly { readonly path: string; readonly priority: number; readonly changeFrequency: MetadataRoute.Sitemap[number]['changeFrequency'] }[] = [
  { path: '/', priority: 1, changeFrequency: 'weekly' },
  { path: '/diagnostic', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/book', priority: 0.9, changeFrequency: 'monthly' },
  { path: '/blog', priority: 0.9, changeFrequency: 'daily' },
  { path: '/privacy-policy', priority: 0.3, changeFrequency: 'yearly' },
  { path: '/terms-of-use', priority: 0.3, changeFrequency: 'yearly' },
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteOrigin = resolveConfiguredAppOrigin();
  if (siteOrigin === null) {
    return [];
  }
  const entries: MetadataRoute.Sitemap = STATIC_MARKETING_PATHS.map((route) => ({
    url: `${siteOrigin}${route.path}`,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
  let posts: Awaited<ReturnType<typeof listPublishedBlogPosts>> = [];
  try {
    posts = await listPublishedBlogPosts();
  } catch {
    return entries;
  }
  for (const post of posts) {
    entries.push({
      url: `${siteOrigin}/blog/${post.slug}`,
      lastModified: new Date(post.publishedAtIso ?? post.updatedAtIso),
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }
  const totalPages = posts.length === 0 ? 0 : Math.ceil(posts.length / BLOG_LIST_PAGE_SIZE);
  for (let page = 2; page <= totalPages; page += 1) {
    entries.push({
      url: `${siteOrigin}${buildBlogListPageHref(page)}`,
      changeFrequency: 'daily',
      priority: 0.5,
    });
  }
  return entries;
}
