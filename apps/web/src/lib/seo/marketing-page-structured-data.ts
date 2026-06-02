import 'server-only';
import type { BlogPostValue } from '@/lib/blog-post-types';
import { resolveBlogPostOpenGraphImageUrl } from '@/lib/blog-post-cover-image';
import { getBlogPostDisplayTitle, getBlogPostSeoDescription } from '@/lib/blog-post-types';
import { resolveConfiguredAppOrigin } from '@/lib/config/app-origin';
import { resolveDefaultMetaDescription } from '@/lib/data/seo-settings';
import {
  buildBlogPostingJsonLd,
  buildBreadcrumbListJsonLd,
  buildOrganizationJsonLd,
  buildWebSiteJsonLd,
  resolveAbsoluteStructuredDataImageUrl,
  resolveAbsoluteStructuredDataUrl,
} from '@/lib/seo/structured-data';
import { loadSeoContext, resolveOpenGraphImagePath } from '@/lib/seo/site-seo';

export async function buildHomePageJsonLd(): Promise<readonly Record<string, unknown>[]> {
  const siteOrigin = resolveConfiguredAppOrigin();
  if (siteOrigin === null) {
    return [];
  }
  const context = await loadSeoContext();
  const description = resolveDefaultMetaDescription(context.settings);
  const logoPath = resolveOpenGraphImagePath(context.settings.defaultOgImageUrl);
  const logoUrl = resolveAbsoluteStructuredDataImageUrl(siteOrigin, logoPath);
  return [
    buildOrganizationJsonLd({
      siteName: context.siteName,
      siteOrigin,
      description,
      logoUrl,
    }),
    buildWebSiteJsonLd({
      siteName: context.siteName,
      siteOrigin,
      description,
    }),
  ];
}

export async function buildBlogArticlePageJsonLd(post: BlogPostValue): Promise<readonly Record<string, unknown>[]> {
  const siteOrigin = resolveConfiguredAppOrigin();
  if (siteOrigin === null) {
    return [];
  }
  const context = await loadSeoContext();
  const articleUrl = resolveAbsoluteStructuredDataUrl(siteOrigin, `/blog/${post.slug}`);
  const homeUrl = resolveAbsoluteStructuredDataUrl(siteOrigin, '/');
  const blogUrl = resolveAbsoluteStructuredDataUrl(siteOrigin, '/blog');
  const headline = getBlogPostDisplayTitle(post);
  const description = getBlogPostSeoDescription(post);
  const coverPath = resolveBlogPostOpenGraphImageUrl(post);
  const imageUrl =
    coverPath !== null && coverPath.length > 0
      ? resolveAbsoluteStructuredDataImageUrl(siteOrigin, coverPath)
      : undefined;
  const datePublished = post.publishedAtIso ?? post.updatedAtIso;
  return [
    buildBlogPostingJsonLd({
      headline,
      description,
      url: articleUrl,
      datePublished,
      dateModified: post.updatedAtIso,
      publisherName: context.siteName,
      imageUrl,
    }),
    buildBreadcrumbListJsonLd([
      { name: context.siteName, url: homeUrl },
      { name: 'Blog', url: blogUrl },
      { name: headline, url: articleUrl },
    ]),
  ];
}

export async function buildBlogIndexPageJsonLd(): Promise<readonly Record<string, unknown>[]> {
  const siteOrigin = resolveConfiguredAppOrigin();
  if (siteOrigin === null) {
    return [];
  }
  const context = await loadSeoContext();
  const homeUrl = resolveAbsoluteStructuredDataUrl(siteOrigin, '/');
  const blogUrl = resolveAbsoluteStructuredDataUrl(siteOrigin, '/blog');
  return [
    buildBreadcrumbListJsonLd([
      { name: context.siteName, url: homeUrl },
      { name: 'Blog', url: blogUrl },
    ]),
  ];
}
