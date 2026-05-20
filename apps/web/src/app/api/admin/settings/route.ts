import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  DIAGNOSTIC_MAX_ROUNDS_MAX,
  DIAGNOSTIC_MAX_ROUNDS_MIN,
  DIAGNOSTIC_OPTIONS_PER_QUESTION_MAX,
  DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN,
  DIAGNOSTIC_QUESTIONS_PER_ROUND_MAX,
  DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN,
} from '@/domain/diagnostic-settings-bounds';
import { getAppSettings, updateAppSettings } from '@/lib/data/app-settings';

const patchSchema = z.object({
  diagnosticAiEnabled: z.boolean().optional(),
  diagnosticManageBookingEnabled: z.boolean().optional(),
  diagnosticMaxRounds: z.number().int().min(DIAGNOSTIC_MAX_ROUNDS_MIN).max(DIAGNOSTIC_MAX_ROUNDS_MAX).optional(),
  diagnosticQuestionsPerRound: z
    .number()
    .int()
    .min(DIAGNOSTIC_QUESTIONS_PER_ROUND_MIN)
    .max(DIAGNOSTIC_QUESTIONS_PER_ROUND_MAX)
    .optional(),
  diagnosticOptionsPerQuestion: z
    .number()
    .int()
    .min(DIAGNOSTIC_OPTIONS_PER_QUESTION_MIN)
    .max(DIAGNOSTIC_OPTIONS_PER_QUESTION_MAX)
    .optional(),
  diagnosticCacheDebugEnabled: z.boolean().optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const settings = await getAppSettings();
    return NextResponse.json(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load settings.', details: message }, { status: 500 });
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
    body.diagnosticAiEnabled === undefined &&
    body.diagnosticManageBookingEnabled === undefined &&
    body.diagnosticMaxRounds === undefined &&
    body.diagnosticQuestionsPerRound === undefined &&
    body.diagnosticOptionsPerQuestion === undefined &&
    body.diagnosticCacheDebugEnabled === undefined
  ) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }
  try {
    const updated = await updateAppSettings(body);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to save settings.', details: message }, { status: 500 });
  }
}
