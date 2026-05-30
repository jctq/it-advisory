import 'server-only';
import { COLLECTIONS } from '@/domain/collections';
import type { MarketingPageSeoKey, PageSeoOverride, SeoSettingsDocument } from '@/domain/seo-settings-types';
import { getDb } from '@/lib/mongodb';
import {
  DEFAULT_SITE_DESCRIPTION,
  DEFAULT_TITLE_SEPARATOR,
  MARKETING_PAGE_SEO_DEFAULTS,
  MARKETING_PAGE_SEO_KEYS,
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_KEYWORDS_MAX_LENGTH,
  SEO_OG_IMAGE_URL_MAX_LENGTH,
  SEO_TITLE_MAX_LENGTH,
  SEO_TWITTER_HANDLE_MAX_LENGTH,
  SEO_VERIFICATION_MAX_LENGTH,
} from '@/lib/seo/seo-defaults';

export const SEO_SETTINGS_DOCUMENT_ID = 'default';

export type PageSeoOverrideValues = {
  readonly title: string;
  readonly description: string;
};

export type SeoSettingsValues = {
  readonly defaultMetaDescription: string;
  readonly defaultOgImageUrl: string;
  readonly defaultKeywords: string;
  readonly titleSeparator: string;
  readonly googleSiteVerification: string;
  readonly bingSiteVerification: string;
  readonly twitterHandle: string;
  readonly noIndexSiteWide: boolean;
  readonly pageOverrides: Readonly<Record<MarketingPageSeoKey, PageSeoOverrideValues>>;
};

export type SeoSettingsAdminView = SeoSettingsValues;

export type ResolvedSeoSettings = SeoSettingsValues & {
  readonly parsedKeywords: readonly string[];
};

function emptyPageOverrides(): Record<MarketingPageSeoKey, PageSeoOverrideValues> {
  return {
    home: { title: '', description: '' },
    diagnostic: { title: '', description: '' },
    book: { title: '', description: '' },
    blog: { title: '', description: '' },
    privacyPolicy: { title: '', description: '' },
    termsOfUse: { title: '', description: '' },
  };
}

function defaultSeoSettings(): SeoSettingsValues {
  return {
    defaultMetaDescription: '',
    defaultOgImageUrl: '',
    defaultKeywords: '',
    titleSeparator: '',
    googleSiteVerification: '',
    bingSiteVerification: '',
    twitterHandle: '',
    noIndexSiteWide: false,
    pageOverrides: emptyPageOverrides(),
  };
}

function trimToMax(value: string, maxLength: number): string {
  return value.trim().slice(0, maxLength);
}

function normalizeOptionalText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') {
    return '';
  }
  return trimToMax(value, maxLength);
}

function normalizeTwitterHandle(value: unknown): string {
  const trimmed = normalizeOptionalText(value, SEO_TWITTER_HANDLE_MAX_LENGTH);
  return trimmed.replace(/^@+/, '');
}

function normalizePageOverride(value: unknown): PageSeoOverrideValues {
  if (value === null || typeof value !== 'object') {
    return { title: '', description: '' };
  }
  const record = value as Partial<PageSeoOverride>;
  return {
    title: normalizeOptionalText(record.title, SEO_TITLE_MAX_LENGTH),
    description: normalizeOptionalText(record.description, SEO_DESCRIPTION_MAX_LENGTH),
  };
}

function normalizePageOverrides(value: unknown): Record<MarketingPageSeoKey, PageSeoOverrideValues> {
  const base = emptyPageOverrides();
  if (value === null || typeof value !== 'object') {
    return base;
  }
  const record = value as Partial<Record<MarketingPageSeoKey, unknown>>;
  for (const key of MARKETING_PAGE_SEO_KEYS) {
    base[key] = normalizePageOverride(record[key]);
  }
  return base;
}

function mergeDocument(doc: SeoSettingsDocument | null): SeoSettingsValues {
  const base = defaultSeoSettings();
  if (doc === null) {
    return base;
  }
  return {
    defaultMetaDescription: normalizeOptionalText(doc.defaultMetaDescription, SEO_DESCRIPTION_MAX_LENGTH),
    defaultOgImageUrl: normalizeOptionalText(doc.defaultOgImageUrl, SEO_OG_IMAGE_URL_MAX_LENGTH),
    defaultKeywords: normalizeOptionalText(doc.defaultKeywords, SEO_KEYWORDS_MAX_LENGTH),
    titleSeparator: normalizeOptionalText(doc.titleSeparator, 20),
    googleSiteVerification: normalizeOptionalText(doc.googleSiteVerification, SEO_VERIFICATION_MAX_LENGTH),
    bingSiteVerification: normalizeOptionalText(doc.bingSiteVerification, SEO_VERIFICATION_MAX_LENGTH),
    twitterHandle: normalizeTwitterHandle(doc.twitterHandle),
    noIndexSiteWide: doc.noIndexSiteWide === true,
    pageOverrides: normalizePageOverrides(doc.pageOverrides),
  };
}

function parseKeywords(raw: string): readonly string[] {
  const trimmed = raw.trim();
  if (trimmed.length === 0) {
    return [];
  }
  return trimmed
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
}

export function resolveSeoSettings(settings: SeoSettingsValues): ResolvedSeoSettings {
  return {
    ...settings,
    parsedKeywords: parseKeywords(settings.defaultKeywords),
  };
}

/**
 * Resolves page title/description: admin override (when non-empty) → hardcoded default.
 */
export function resolvePageSeo(
  pageKey: MarketingPageSeoKey,
  hardcoded: PageSeoOverride,
  settings: SeoSettingsValues,
): PageSeoOverride {
  const override = settings.pageOverrides[pageKey] ?? { title: '', description: '' };
  const title = override.title.length > 0 ? override.title : hardcoded.title;
  const description =
    override.description.length > 0
      ? override.description
      : hardcoded.description.length > 0
        ? hardcoded.description
        : settings.defaultMetaDescription.length > 0
          ? settings.defaultMetaDescription
          : DEFAULT_SITE_DESCRIPTION;
  return { title, description };
}

export function resolveDefaultMetaDescription(settings: SeoSettingsValues): string {
  const trimmed = settings.defaultMetaDescription.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_SITE_DESCRIPTION;
}

export function resolveTitleSeparator(settings: SeoSettingsValues): string {
  const trimmed = settings.titleSeparator.trim();
  return trimmed.length > 0 ? trimmed : DEFAULT_TITLE_SEPARATOR;
}

export async function getSeoSettings(): Promise<SeoSettingsValues> {
  if (!process.env.MONGODB_URI) {
    return defaultSeoSettings();
  }
  const db = await getDb();
  const doc = await db
    .collection<SeoSettingsDocument>(COLLECTIONS.seoSettings)
    .findOne({ _id: SEO_SETTINGS_DOCUMENT_ID });
  return mergeDocument(doc);
}

export async function getResolvedSeoSettings(): Promise<ResolvedSeoSettings> {
  const settings = await getSeoSettings();
  return resolveSeoSettings(settings);
}

export async function getSeoSettingsAdminView(): Promise<SeoSettingsAdminView> {
  return getSeoSettings();
}

export type SeoSettingsPatch = Partial<Omit<SeoSettingsValues, 'pageOverrides'>> & {
  readonly pageOverrides?: Partial<Readonly<Record<MarketingPageSeoKey, Partial<PageSeoOverrideValues>>>>;
};

export async function updateSeoSettings(patch: SeoSettingsPatch): Promise<SeoSettingsAdminView> {
  if (!process.env.MONGODB_URI) {
    throw new Error('MongoDB is not configured. Set MONGODB_URI to save SEO settings.');
  }
  const current = await getSeoSettings();
  const nextPageOverrides = { ...current.pageOverrides };
  if (patch.pageOverrides !== undefined) {
    for (const key of MARKETING_PAGE_SEO_KEYS) {
      const pagePatch = patch.pageOverrides[key];
      if (pagePatch !== undefined) {
        nextPageOverrides[key] = normalizePageOverride(pagePatch);
      }
    }
  }
  const next: SeoSettingsValues = {
    defaultMetaDescription:
      patch.defaultMetaDescription !== undefined
        ? normalizeOptionalText(patch.defaultMetaDescription, SEO_DESCRIPTION_MAX_LENGTH)
        : current.defaultMetaDescription,
    defaultOgImageUrl:
      patch.defaultOgImageUrl !== undefined
        ? normalizeOptionalText(patch.defaultOgImageUrl, SEO_OG_IMAGE_URL_MAX_LENGTH)
        : current.defaultOgImageUrl,
    defaultKeywords:
      patch.defaultKeywords !== undefined
        ? normalizeOptionalText(patch.defaultKeywords, SEO_KEYWORDS_MAX_LENGTH)
        : current.defaultKeywords,
    titleSeparator:
      patch.titleSeparator !== undefined ? normalizeOptionalText(patch.titleSeparator, 20) : current.titleSeparator,
    googleSiteVerification:
      patch.googleSiteVerification !== undefined
        ? normalizeOptionalText(patch.googleSiteVerification, SEO_VERIFICATION_MAX_LENGTH)
        : current.googleSiteVerification,
    bingSiteVerification:
      patch.bingSiteVerification !== undefined
        ? normalizeOptionalText(patch.bingSiteVerification, SEO_VERIFICATION_MAX_LENGTH)
        : current.bingSiteVerification,
    twitterHandle:
      patch.twitterHandle !== undefined ? normalizeTwitterHandle(patch.twitterHandle) : current.twitterHandle,
    noIndexSiteWide: patch.noIndexSiteWide !== undefined ? patch.noIndexSiteWide : current.noIndexSiteWide,
    pageOverrides: nextPageOverrides,
  };
  const db = await getDb();
  const row: SeoSettingsDocument = {
    _id: SEO_SETTINGS_DOCUMENT_ID,
    defaultMetaDescription: next.defaultMetaDescription.length > 0 ? next.defaultMetaDescription : undefined,
    defaultOgImageUrl: next.defaultOgImageUrl.length > 0 ? next.defaultOgImageUrl : undefined,
    defaultKeywords: next.defaultKeywords.length > 0 ? next.defaultKeywords : undefined,
    titleSeparator: next.titleSeparator.length > 0 ? next.titleSeparator : undefined,
    googleSiteVerification: next.googleSiteVerification.length > 0 ? next.googleSiteVerification : undefined,
    bingSiteVerification: next.bingSiteVerification.length > 0 ? next.bingSiteVerification : undefined,
    twitterHandle: next.twitterHandle.length > 0 ? next.twitterHandle : undefined,
    noIndexSiteWide: next.noIndexSiteWide ? true : undefined,
    pageOverrides: MARKETING_PAGE_SEO_KEYS.reduce<Partial<Record<MarketingPageSeoKey, PageSeoOverride>>>(
      (accumulator, key) => {
        const override = next.pageOverrides[key] ?? { title: '', description: '' };
        if (override.title.length > 0 || override.description.length > 0) {
          accumulator[key] = override;
        }
        return accumulator;
      },
      {},
    ),
    updatedAt: new Date(),
  };
  await db.collection<SeoSettingsDocument>(COLLECTIONS.seoSettings).replaceOne({ _id: SEO_SETTINGS_DOCUMENT_ID }, row, {
    upsert: true,
  });
  return next;
}

export { MARKETING_PAGE_SEO_DEFAULTS };
