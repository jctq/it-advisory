import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupportSettingsAdminView, updateSupportSettings } from '@/lib/data/support-settings';

const patchSchema = z.object({
  notificationEmails: z.string().max(4000).optional(),
  sendReporterConfirmationEmail: z.boolean().optional(),
  sendReporterReplyEmail: z.boolean().optional(),
  allowReporterFollowUpReplies: z.boolean().optional(),
  reporterReplyMinIntervalSeconds: z.number().int().min(30).max(3600).optional(),
  reporterReplyMaxPerHour: z.number().int().min(1).max(30).optional(),
  sendStaffEmailOnReporterFollowUp: z.boolean().optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const settings = await getSupportSettingsAdminView();
    return NextResponse.json(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load support settings.', details: message }, { status: 500 });
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
  if (
    parsed.data.notificationEmails === undefined &&
    parsed.data.sendReporterConfirmationEmail === undefined &&
    parsed.data.sendReporterReplyEmail === undefined &&
    parsed.data.allowReporterFollowUpReplies === undefined &&
    parsed.data.reporterReplyMinIntervalSeconds === undefined &&
    parsed.data.reporterReplyMaxPerHour === undefined &&
    parsed.data.sendStaffEmailOnReporterFollowUp === undefined
  ) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }
  try {
    const updated = await updateSupportSettings(parsed.data);
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message.includes('valid email') ? 400 : 500;
    return NextResponse.json({ error: 'Failed to save support settings.', details: message }, { status });
  }
}
