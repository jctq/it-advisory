type BreadcrumbItem = {
  readonly name: string;
  readonly url: string;
};

type OrganizationJsonLdInput = {
  readonly siteName: string;
  readonly siteOrigin: string;
  readonly description: string;
  readonly logoUrl: string;
};

type WebSiteJsonLdInput = {
  readonly siteName: string;
  readonly siteOrigin: string;
  readonly description: string;
};

type BlogPostingJsonLdInput = {
  readonly headline: string;
  readonly description: string;
  readonly url: string;
  readonly datePublished: string;
  readonly dateModified: string;
  readonly publisherName: string;
  readonly imageUrl?: string;
};

export function buildOrganizationJsonLd(input: OrganizationJsonLdInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: input.siteName,
    url: input.siteOrigin,
    logo: input.logoUrl,
    description: input.description,
  };
}

export function buildWebSiteJsonLd(input: WebSiteJsonLdInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: input.siteName,
    url: input.siteOrigin,
    description: input.description,
  };
}

export function buildBlogPostingJsonLd(input: BlogPostingJsonLdInput): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: input.headline,
    description: input.description,
    url: input.url,
    datePublished: input.datePublished,
    dateModified: input.dateModified,
    author: {
      '@type': 'Organization',
      name: input.publisherName,
    },
    publisher: {
      '@type': 'Organization',
      name: input.publisherName,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': input.url,
    },
    ...(input.imageUrl !== undefined ? { image: [input.imageUrl] } : {}),
  };
}

export function buildBreadcrumbListJsonLd(items: readonly BreadcrumbItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function resolveAbsoluteStructuredDataUrl(siteOrigin: string, pathname: string): string {
  const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`;
  return `${siteOrigin}${normalizedPath}`;
}

export function resolveAbsoluteStructuredDataImageUrl(siteOrigin: string, imagePath: string): string {
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }
  return resolveAbsoluteStructuredDataUrl(siteOrigin, imagePath);
}
