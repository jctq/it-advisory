import type { Metadata } from 'next';
import { brandAssetUrl } from '@/lib/brand/brand-assets';
import { resolveConfiguredAppOrigin } from '@/lib/config/app-origin';

export const SITE_NAME = 'TechMD' as const;

const DEFAULT_SITE_DESCRIPTION =
  'Technology consultation. Better decisions. Stronger business. Guided diagnostics and expert sessions.';

const DEFAULT_OG_IMAGE_PATH = brandAssetUrl('techmd-mark-512x512.png');

const NO_INDEX_ROBOTS: NonNullable<Metadata['robots']> = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
};

type BuildMarketingMetadataInput = {
  readonly title: string;
  readonly description: string;
  readonly pathname: string;
  readonly openGraphType?: 'website' | 'article';
  readonly openGraphImageUrl?: string | null;
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
 * Normalizes a cover image or brand asset path for Open Graph / Twitter cards.
 */
export function resolveOpenGraphImagePath(imageUrl: string | null | undefined): string {
  const fallbackImage = DEFAULT_OG_IMAGE_PATH;
  if (imageUrl === undefined || imageUrl === null) {
    return fallbackImage;
  }
  const trimmed = imageUrl.trim();
  if (trimmed.length === 0) {
    return fallbackImage;
  }
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed;
  }
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function buildSocialMetadata(input: BuildMarketingMetadataInput): Pick<Metadata, 'openGraph' | 'twitter'> {
  const imagePath = resolveOpenGraphImagePath(input.openGraphImageUrl);
  const openGraphType = input.openGraphType ?? 'website';
  return {
    openGraph: {
      type: openGraphType,
      siteName: SITE_NAME,
      title: input.title,
      description: input.description,
      url: input.pathname,
      images: [
        {
          url: imagePath,
          alt: `${SITE_NAME} — Technology consultation`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: input.title,
      description: input.description,
      images: [imagePath],
    },
  };
}

/**
 * Indexable marketing metadata with canonical URL, Open Graph, and Twitter cards.
 */
export function buildMarketingMetadata(input: BuildMarketingMetadataInput): Metadata {
  return {
    title: input.title,
    description: input.description,
    alternates: {
      canonical: input.pathname,
    },
    ...buildSocialMetadata(input),
  };
}

/**
 * Default site-wide metadata for the root layout (fallback title/description and social defaults).
 * Canonical URLs are set per route via buildMarketingMetadata — not here — to avoid inheriting "/".
 */
export function buildRootLayoutMetadata(): Metadata {
  const title = `${SITE_NAME} — Technology Consultation`;
  return {
    title,
    description: DEFAULT_SITE_DESCRIPTION,
    ...buildSocialMetadata({
      title,
      description: DEFAULT_SITE_DESCRIPTION,
      pathname: '/',
    }),
  };
}

/**
 * Metadata for routes that must not appear in search results.
 */
export function buildNoIndexMetadata(input: BuildNoIndexMetadataInput): Metadata {
  const description = input.description ?? DEFAULT_SITE_DESCRIPTION;
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
