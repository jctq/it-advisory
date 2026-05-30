import type { Metadata } from 'next';
import type { MarketingPageSeoKey } from '@/domain/seo-settings-types';
import { brandAssetUrl } from '@/lib/brand/brand-assets';
import { resolveConfiguredAppOrigin } from '@/lib/config/app-origin';
import { getResolvedSiteName } from '@/lib/data/app-settings';
import {
  getResolvedSeoSettings,
  resolveDefaultMetaDescription,
  resolvePageSeo,
  type ResolvedSeoSettings,
} from '@/lib/data/seo-settings';
import { readEnvSiteName } from '@/lib/site/site-name';
import { DEFAULT_SITE_DESCRIPTION, MARKETING_PAGE_SEO_DEFAULTS } from '@/lib/seo/seo-defaults';

/** Env-based site name for static metadata; runtime pages use {@link getResolvedSiteName}. */
export const SITE_NAME = readEnvSiteName();

export { DEFAULT_SITE_DESCRIPTION };

const DEFAULT_OG_IMAGE_PATH = brandAssetUrl('techmd-mark-512x512.png');

const NO_INDEX_ROBOTS: NonNullable<Metadata['robots']> = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
};

export type SeoContext = {
  readonly siteName: string;
  readonly settings: ResolvedSeoSettings;
};

type BuildMarketingMetadataInput = {
  readonly title: string;
  readonly description: string;
  readonly pathname: string;
  readonly openGraphType?: 'website' | 'article';
  readonly openGraphImageUrl?: string | null;
  readonly keywords?: readonly string[];
};

type BuildNoIndexMetadataInput = {
  readonly title: string;
  readonly description?: string;
};

/**
 * Resolves metadataBase for the root layout from NEXT_PUBLIC_APP_URL.
 */
export function resolveMetadataBase(): URL | undefined {
  const configuredOrigin = resolveConfiguredAppOrigin();
  if (configuredOrigin === null) {
    return undefined;
  }
  return new URL(configuredOrigin);
}

/**
 * Loads resolved site name and SEO settings for metadata generation.
 */
export async function loadSeoContext(): Promise<SeoContext> {
  const [siteName, settings] = await Promise.all([getResolvedSiteName(), getResolvedSeoSettings()]);
  return { siteName, settings };
}

/**
 * Normalizes a cover image or brand asset path for Open Graph / Twitter cards.
 */
export function resolveOpenGraphImagePath(
  imageUrl: string | null | undefined,
  defaultOgImageUrl?: string,
): string {
  if (imageUrl !== undefined && imageUrl !== null) {
    const trimmed = imageUrl.trim();
    if (trimmed.length > 0) {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        return trimmed;
      }
      return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    }
  }
  if (defaultOgImageUrl !== undefined && defaultOgImageUrl.trim().length > 0) {
    return resolveOpenGraphImagePath(defaultOgImageUrl, undefined);
  }
  return DEFAULT_OG_IMAGE_PATH;
}

function mergeKeywords(
  pageKeywords: readonly string[] | undefined,
  globalKeywords: readonly string[],
): string[] | undefined {
  const merged = [...(pageKeywords ?? []), ...globalKeywords];
  if (merged.length === 0) {
    return undefined;
  }
  return [...new Set(merged)];
}

function buildVerificationMetadata(settings: ResolvedSeoSettings): Pick<Metadata, 'verification'> | undefined {
  const google = settings.googleSiteVerification.trim();
  const bing = settings.bingSiteVerification.trim();
  if (google.length === 0 && bing.length === 0) {
    return undefined;
  }
  const verification: NonNullable<Metadata['verification']> = {};
  if (google.length > 0) {
    verification.google = google;
  }
  if (bing.length > 0) {
    verification.other = { 'msvalidate.01': bing };
  }
  return { verification };
}

function buildSocialMetadata(
  input: BuildMarketingMetadataInput,
  context: SeoContext,
): Pick<Metadata, 'openGraph' | 'twitter'> {
  const imagePath = resolveOpenGraphImagePath(input.openGraphImageUrl, context.settings.defaultOgImageUrl);
  const openGraphType = input.openGraphType ?? 'website';
  const twitterSite =
    context.settings.twitterHandle.trim().length > 0 ? `@${context.settings.twitterHandle.trim()}` : undefined;
  return {
    openGraph: {
      type: openGraphType,
      siteName: context.siteName,
      title: input.title,
      description: input.description,
      url: input.pathname,
      images: [
        {
          url: imagePath,
          alt: `${context.siteName} — Technology consultation`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images: [imagePath],
      ...(twitterSite !== undefined ? { site: twitterSite } : {}),
    },
  };
}

/**
 * Indexable marketing metadata with canonical URL, Open Graph, and Twitter cards.
 */
export function buildMarketingMetadataWithContext(
  input: BuildMarketingMetadataInput,
  context: SeoContext,
): Metadata {
  const keywords = mergeKeywords(input.keywords, context.settings.parsedKeywords);
  const robots = context.settings.noIndexSiteWide ? NO_INDEX_ROBOTS : undefined;
  return {
    title: input.title,
    description: input.description,
    ...(keywords !== undefined ? { keywords } : {}),
    ...(robots !== undefined ? { robots } : {}),
    alternates: {
      canonical: input.pathname,
    },
    ...buildSocialMetadata(input, context),
  };
}

/**
 * Default site-wide metadata for the root layout (fallback title/description and social defaults).
 * Canonical URLs are set per route via buildMarketingMetadata — not here — to avoid inheriting "/".
 */
export function buildRootLayoutMetadataWithContext(context: SeoContext): Metadata {
  const description = resolveDefaultMetaDescription(context.settings);
  const title = `${context.siteName} — Technology Consultation`;
  return {
    title,
    description,
    ...buildVerificationMetadata(context.settings),
    ...buildSocialMetadata(
      {
        title,
        description,
        pathname: '/',
      },
      context,
    ),
  };
}

/**
 * Metadata for routes that must not appear in search results.
 */
export function buildNoIndexMetadataWithContext(
  input: BuildNoIndexMetadataInput,
  context: SeoContext,
): Metadata {
  const description = input.description ?? resolveDefaultMetaDescription(context.settings);
  return {
    title: input.title,
    description,
    robots: NO_INDEX_ROBOTS,
    openGraph: {
      title: input.title,
      description,
    },
    twitter: {
      title: input.title,
      description,
    },
  };
}

export async function buildMarketingMetadataAsync(input: BuildMarketingMetadataInput): Promise<Metadata> {
  const context = await loadSeoContext();
  return buildMarketingMetadataWithContext(input, context);
}

export async function buildPageMetadata(
  pageKey: MarketingPageSeoKey,
  input: Omit<BuildMarketingMetadataInput, 'title' | 'description'> & {
    readonly title?: string;
    readonly description?: string;
  },
): Promise<Metadata> {
  const context = await loadSeoContext();
  const hardcoded = MARKETING_PAGE_SEO_DEFAULTS[pageKey];
  const resolved = resolvePageSeo(
    pageKey,
    {
      title: input.title ?? hardcoded.title,
      description: input.description ?? hardcoded.description,
    },
    context.settings,
  );
  return buildMarketingMetadataWithContext(
    {
      ...input,
      title: resolved.title,
      description: resolved.description,
    },
    context,
  );
}

export async function buildRootLayoutMetadataAsync(): Promise<Metadata> {
  const context = await loadSeoContext();
  return buildRootLayoutMetadataWithContext(context);
}

export async function buildNoIndexMetadataAsync(input: BuildNoIndexMetadataInput): Promise<Metadata> {
  const context = await loadSeoContext();
  return buildNoIndexMetadataWithContext(input, context);
}

/** @deprecated Use {@link buildMarketingMetadataAsync} or {@link buildMarketingMetadataWithContext}. */
export function buildMarketingMetadata(input: BuildMarketingMetadataInput): Metadata {
  const context: SeoContext = {
    siteName: SITE_NAME,
    settings: {
      defaultMetaDescription: '',
      defaultOgImageUrl: '',
      defaultKeywords: '',
      titleSeparator: '',
      googleSiteVerification: '',
      bingSiteVerification: '',
      twitterHandle: '',
      noIndexSiteWide: false,
      pageOverrides: {
        home: { title: '', description: '' },
        diagnostic: { title: '', description: '' },
        book: { title: '', description: '' },
        blog: { title: '', description: '' },
        privacyPolicy: { title: '', description: '' },
        termsOfUse: { title: '', description: '' },
      },
      parsedKeywords: [],
    },
  };
  return buildMarketingMetadataWithContext(input, context);
}

/** @deprecated Use {@link buildRootLayoutMetadataAsync} or {@link buildRootLayoutMetadataWithContext}. */
export function buildRootLayoutMetadata(): Metadata {
  const context: SeoContext = {
    siteName: SITE_NAME,
    settings: {
      defaultMetaDescription: '',
      defaultOgImageUrl: '',
      defaultKeywords: '',
      titleSeparator: '',
      googleSiteVerification: '',
      bingSiteVerification: '',
      twitterHandle: '',
      noIndexSiteWide: false,
      pageOverrides: {
        home: { title: '', description: '' },
        diagnostic: { title: '', description: '' },
        book: { title: '', description: '' },
        blog: { title: '', description: '' },
        privacyPolicy: { title: '', description: '' },
        termsOfUse: { title: '', description: '' },
      },
      parsedKeywords: [],
    },
  };
  return buildRootLayoutMetadataWithContext(context);
}

/** @deprecated Use {@link buildNoIndexMetadataAsync} or {@link buildNoIndexMetadataWithContext}. */
export function buildNoIndexMetadata(input: BuildNoIndexMetadataInput): Metadata {
  const context: SeoContext = {
    siteName: SITE_NAME,
    settings: {
      defaultMetaDescription: '',
      defaultOgImageUrl: '',
      defaultKeywords: '',
      titleSeparator: '',
      googleSiteVerification: '',
      bingSiteVerification: '',
      twitterHandle: '',
      noIndexSiteWide: false,
      pageOverrides: {
        home: { title: '', description: '' },
        diagnostic: { title: '', description: '' },
        book: { title: '', description: '' },
        blog: { title: '', description: '' },
        privacyPolicy: { title: '', description: '' },
        termsOfUse: { title: '', description: '' },
      },
      parsedKeywords: [],
    },
  };
  return buildNoIndexMetadataWithContext(input, context);
}

/**
 * Path prefixes disallowed in robots.txt (entry paths without trailing slash stay allowed).
 */
export const ROBOTS_DISALLOW_PREFIXES: readonly string[] = [
  '/admin/',
  '/api/',
  '/account/',
  '/login',
  '/register',
  '/confirmation',
  '/book/payment/',
  '/book/manage',
  '/diagnostic/',
  '/book/',
] as const;
