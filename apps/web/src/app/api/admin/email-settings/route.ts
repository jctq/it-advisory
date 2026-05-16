import { NextResponse } from 'next/server';
import { z } from 'zod';
import { TRANSACTIONAL_EMAIL_PROVIDER_IDS, type TransactionalEmailProviderId } from '@/domain/email-types';
import {
  EmailSettingsCredentialValidationError,
  executeTransactionalEmailProviderConnectionTest,
  getEmailSettingsAdminView,
  updateEmailSettings,
} from '@/lib/data/email-settings';

const ACTIVE_PROVIDER_SCHEMA = z.enum(['none', 'resend', 'postmark', 'sendgrid']);

const providerCredentialsSchema = z.record(z.string(), z.string()).nullable().optional();

const patchSchema = z.object({
  activeProvider: ACTIVE_PROVIDER_SCHEMA.optional(),
  sandboxMode: z.boolean().optional(),
  bookingConfirmationBcc: z.string().max(2000).optional(),
  providerCredentials: z
    .object({
      resend: providerCredentialsSchema,
      postmark: providerCredentialsSchema,
      sendgrid: providerCredentialsSchema,
    })
    .optional(),
  testProviderId: z.enum(TRANSACTIONAL_EMAIL_PROVIDER_IDS).optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const settings = await getEmailSettingsAdminView();
    return NextResponse.json(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load email settings.', details: message }, { status: 500 });
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
    body.activeProvider === undefined &&
    body.sandboxMode === undefined &&
    body.bookingConfirmationBcc === undefined &&
    body.providerCredentials === undefined &&
    body.testProviderId === undefined
  ) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }
  try {
    if (body.testProviderId !== undefined) {
      const test = await executeTransactionalEmailProviderConnectionTest(body.testProviderId);
      return NextResponse.json(test);
    }
    const updated = await updateEmailSettings({
      activeProvider: body.activeProvider,
      sandboxMode: body.sandboxMode,
      bookingConfirmationBcc: body.bookingConfirmationBcc,
      providerCredentials: body.providerCredentials as
        | Partial<Record<TransactionalEmailProviderId, Record<string, string> | null>>
        | undefined,
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (error instanceof EmailSettingsCredentialValidationError) {
      return NextResponse.json({ error: 'Invalid email credentials.', details: message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to save email settings.', details: message }, { status: 500 });
  }
}
