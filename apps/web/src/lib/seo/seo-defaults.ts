import type { MarketingPageSeoKey, PageSeoOverride } from '@/domain/seo-settings-types';

export const DEFAULT_SITE_DESCRIPTION =
  'Technology consultation. Better decisions. Stronger business. Guided diagnostics and expert sessions.';

export const DEFAULT_TITLE_SEPARATOR = ' — ';

export const SEO_TITLE_MAX_LENGTH = 70;
export const SEO_DESCRIPTION_MAX_LENGTH = 320;
export const SEO_KEYWORDS_MAX_LENGTH = 500;
export const SEO_OG_IMAGE_URL_MAX_LENGTH = 2000;
export const SEO_VERIFICATION_MAX_LENGTH = 256;
export const SEO_TWITTER_HANDLE_MAX_LENGTH = 50;

export const MARKETING_PAGE_SEO_KEYS: readonly MarketingPageSeoKey[] = [
  'home',
  'diagnostic',
  'book',
  'blog',
  'privacyPolicy',
  'termsOfUse',
] as const;

export const MARKETING_PAGE_SEO_DEFAULTS: Readonly<Record<MarketingPageSeoKey, PageSeoOverride>> = {
  home: {
    title: 'TeqMD for Growing Businesses',
    description:
      'Independent, vendor-neutral IT guidance for Philippine businesses — from diagnostic to booking.',
  },
  diagnostic: {
    title: 'Guided diagnostic · TeqMD',
    description:
      'Describe your situation, answer short guided intake questions, then finish the diagnostic for a tailored recommendation.',
  },
  book: {
    title: 'Book a session · TeqMD',
    description: 'Choose a Philippine-time slot for your consultation.',
  },
  blog: {
    title: 'Blog — TeqMD',
    description: 'Technology guidance articles for growing teams in the Philippines.',
  },
  privacyPolicy: {
    title: 'Privacy Policy · TeqMD',
    description: 'How TeqMD collects, uses, and protects your information.',
  },
  termsOfUse: {
    title: 'Terms of Use · TeqMD',
    description: 'Terms governing use of the TeqMD website and services.',
  },
};

export const MARKETING_PAGE_SEO_LABELS: Readonly<Record<MarketingPageSeoKey, string>> = {
  home: 'Home',
  diagnostic: 'Diagnostic',
  book: 'Book a session',
  blog: 'Blog index',
  privacyPolicy: 'Privacy policy',
  termsOfUse: 'Terms of use',
};
