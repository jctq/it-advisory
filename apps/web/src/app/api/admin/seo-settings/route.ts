import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { MarketingPageSeoKey } from '@/domain/seo-settings-types';
import { getSeoSettingsAdminView, updateSeoSettings } from '@/lib/data/seo-settings';
import {
  MARKETING_PAGE_SEO_KEYS,
  SEO_DESCRIPTION_MAX_LENGTH,
  SEO_KEYWORDS_MAX_LENGTH,
  SEO_OG_IMAGE_URL_MAX_LENGTH,
  SEO_TITLE_MAX_LENGTH,
  SEO_TWITTER_HANDLE_MAX_LENGTH,
  SEO_VERIFICATION_MAX_LENGTH,
} from '@/lib/seo/seo-defaults';

const pageOverrideSchema = z.object({
  title: z.string().max(SEO_TITLE_MAX_LENGTH).optional(),
  description: z.string().max(SEO_DESCRIPTION_MAX_LENGTH).optional(),
});

const pageOverridesSchema = z
  .object(
    MARKETING_PAGE_SEO_KEYS.reduce<Record<MarketingPageSeoKey, typeof pageOverrideSchema>>(
      (accumulator, key) => {
        accumulator[key] = pageOverrideSchema;
        return accumulator;
      },
      {} as Record<MarketingPageSeoKey, typeof pageOverrideSchema>,
    ),
  )
  .partial();

const patchSchema = z.object({
  defaultMetaDescription: z.string().max(SEO_DESCRIPTION_MAX_LENGTH).optional(),
  defaultOgImageUrl: z.string().max(SEO_OG_IMAGE_URL_MAX_LENGTH).optional(),
  defaultKeywords: z.string().max(SEO_KEYWORDS_MAX_LENGTH).optional(),
  titleSeparator: z.string().max(20).optional(),
  googleSiteVerification: z.string().max(SEO_VERIFICATION_MAX_LENGTH).optional(),
  bingSiteVerification: z.string().max(SEO_VERIFICATION_MAX_LENGTH).optional(),
  twitterHandle: z.string().max(SEO_TWITTER_HANDLE_MAX_LENGTH).optional(),
  noIndexSiteWide: z.boolean().optional(),
  pageOverrides: pageOverridesSchema.optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const settings = await getSeoSettingsAdminView();
    return NextResponse.json(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load SEO settings.', details: message }, { status: 500 });
  }
}

export async function PATCH(request: Request): Promise<NextResponse> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  const body = parsed.data;
  if (
    body.defaultMetaDescription === undefined &&
    body.defaultOgImageUrl === undefined &&
    body.defaultKeywords === undefined &&
    body.titleSeparator === undefined &&
    body.googleSiteVerification === undefined &&
    body.bingSiteVerification === undefined &&
    body.twitterHandle === undefined &&
    body.noIndexSiteWide === undefined &&
    body.pageOverrides === undefined
  ) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }
  try {
    const updated = await updateSeoSettings(body);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to save SEO settings.', details: message }, { status: 500 });
  }
}
