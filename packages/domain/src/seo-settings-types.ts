/** Singleton `_id: 'default'` — site-wide SEO and per-page marketing meta overrides (admin). */
export type MarketingPageSeoKey =
  | 'home'
  | 'diagnostic'
  | 'book'
  | 'blog'
  | 'privacyPolicy'
  | 'termsOfUse';

export type PageSeoOverride = {
  readonly title: string;
  readonly description: string;
};

export type SeoSettingsDocument = {
  _id: string;
  defaultMetaDescription?: string;
  defaultOgImageUrl?: string;
  defaultKeywords?: string;
  titleSeparator?: string;
  googleSiteVerification?: string;
  bingSiteVerification?: string;
  twitterHandle?: string;
  noIndexSiteWide?: boolean;
  pageOverrides?: Partial<Record<MarketingPageSeoKey, PageSeoOverride>>;
  updatedAt: Date;
};
