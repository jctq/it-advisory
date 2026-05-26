import { NextResponse } from 'next/server';
import { z } from 'zod';
import { RECORDING_PROVIDER_IDS, type RecordingProviderId } from '@/domain/recording-types';
import {
  executeFathomConnectionTest,
  getRecordingSettingsAdminView,
  RecordingSettingsCredentialValidationError,
  updateRecordingSettings,
} from '@/lib/data/recording-settings';

const ACTIVE_PROVIDER_SCHEMA = z.enum(['none', ...RECORDING_PROVIDER_IDS]);

const providerCredentialsSchema = z.record(z.string(), z.string()).nullable().optional();

const patchSchema = z.object({
  recordingsEnabled: z.boolean().optional(),
  recordingOptInPriceCentavos: z.number().int().min(0).max(100_000_000).optional(),
  activeProvider: ACTIVE_PROVIDER_SCHEMA.optional(),
  providerCredentials: z
    .object({
      fathom: providerCredentialsSchema,
    })
    .optional(),
  testFathom: z.boolean().optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const settings = await getRecordingSettingsAdminView();
    return NextResponse.json(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load recording settings.', details: message }, { status: 500 });
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
  if (body.testFathom === true) {
    const test = await executeFathomConnectionTest();
    return NextResponse.json(test);
  }
  try {
    const updated = await updateRecordingSettings({
      recordingsEnabled: body.recordingsEnabled,
      recordingOptInPriceCentavos: body.recordingOptInPriceCentavos,
      activeProvider: body.activeProvider,
      providerCredentials: body.providerCredentials as
        | Partial<Record<RecordingProviderId, Record<string, string> | null>>
        | undefined,
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (error instanceof RecordingSettingsCredentialValidationError) {
      return NextResponse.json({ error: 'Invalid recording credentials.', details: message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to save recording settings.', details: message }, { status: 500 });
  }
}
