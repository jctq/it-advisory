import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CATALOG_SERVICE_KINDS, PROMO_DISCOUNT_TYPES } from '@/domain/monetization-types';
import {
  getMonetizationSettingsAdminView,
  updateMonetizationSettings,
} from '@/lib/data/monetization-settings';

const catalogServiceSchema = z.object({
  serviceKey: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).default(''),
  durationLabel: z.string().min(1).max(80),
  amountCentavos: z.number().int().min(100).max(100_000_000),
  enabled: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
  kind: z.enum(CATALOG_SERVICE_KINDS),
  sessionsIncluded: z.number().int().min(1).max(99).nullable().optional(),
  deletedAt: z.string().min(1).nullable().optional(),
});

const promoCodeSchema = z.object({
  code: z.string().min(1).max(64),
  discountType: z.enum(PROMO_DISCOUNT_TYPES),
  discountValue: z.number().int().min(0).max(100_000_000),
  applicableServiceKeys: z.array(z.string().min(1).max(120)).nullable().optional(),
  maxRedemptions: z.number().int().min(0).max(1_000_000),
  redemptionCount: z.number().int().min(0).max(1_000_000),
  validFrom: z.string().min(1).nullable().optional(),
  validUntil: z.string().min(1).nullable().optional(),
  enabled: z.boolean(),
  deletedAt: z.string().min(1).nullable().optional(),
});

const patchSchema = z.object({
  services: z.array(catalogServiceSchema).optional(),
  promoCodes: z.array(promoCodeSchema).optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const settings = await getMonetizationSettingsAdminView();
    return NextResponse.json(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load pricing settings.', details: message }, { status: 500 });
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
  if (body.services === undefined && body.promoCodes === undefined) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }
  try {
    const updated = await updateMonetizationSettings({
      services: body.services?.map((entry) => ({
        ...entry,
        sessionsIncluded: entry.sessionsIncluded ?? null,
        deletedAt: entry.deletedAt !== undefined && entry.deletedAt !== null ? new Date(entry.deletedAt) : null,
      })),
      promoCodes: body.promoCodes?.map((entry) => ({
        ...entry,
        applicableServiceKeys: entry.applicableServiceKeys ?? null,
        validFrom: entry.validFrom !== undefined && entry.validFrom !== null ? new Date(entry.validFrom) : null,
        validUntil: entry.validUntil !== undefined && entry.validUntil !== null ? new Date(entry.validUntil) : null,
        deletedAt: entry.deletedAt !== undefined && entry.deletedAt !== null ? new Date(entry.deletedAt) : null,
      })),
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to save pricing settings.', details: message }, { status: 500 });
  }
}
