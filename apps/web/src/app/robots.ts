import type { MetadataRoute } from 'next';
import { resolveConfiguredAppOrigin } from '@/lib/config/app-origin';
import { ROBOTS_DISALLOW_PREFIXES } from '@/lib/seo/site-seo';

export default function robots(): MetadataRoute.Robots {
  const siteOrigin = resolveConfiguredAppOrigin();
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [...ROBOTS_DISALLOW_PREFIXES],
    },
    sitemap: siteOrigin === null ? undefined : `${siteOrigin}/sitemap.xml`,
  };
}
