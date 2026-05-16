import { NextResponse } from 'next/server';
import { z } from 'zod';
import { VIDEO_MEETING_PROVIDER_IDS, type VideoMeetingProviderId } from '@/domain/meeting-types';
import {
  executeGoogleMeetConnectionTest,
  executeMicrosoftTeamsConnectionTest,
  executeZoomMeetingConnectionTest,
  getMeetingSettingsAdminView,
  MeetingSettingsCredentialValidationError,
  updateMeetingSettings,
} from '@/lib/data/meeting-settings';

const ACTIVE_PROVIDER_SCHEMA = z.enum(['none', ...VIDEO_MEETING_PROVIDER_IDS]);

const providerCredentialsSchema = z.record(z.string(), z.string()).nullable().optional();

const patchSchema = z.object({
  activeProvider: ACTIVE_PROVIDER_SCHEMA.optional(),
  providerCredentials: z
    .object({
      zoom: providerCredentialsSchema,
      googleMeet: providerCredentialsSchema,
      microsoftTeams: providerCredentialsSchema,
    })
    .optional(),
  testProviderId: z.enum([...VIDEO_MEETING_PROVIDER_IDS]).optional(),
});

export async function GET(): Promise<NextResponse> {
  try {
    const settings = await getMeetingSettingsAdminView();
    return NextResponse.json(settings);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load meeting settings.', details: message }, { status: 500 });
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
    body.providerCredentials === undefined &&
    body.testProviderId === undefined
  ) {
    return NextResponse.json({ error: 'No fields to update.' }, { status: 400 });
  }
  try {
    if (body.testProviderId !== undefined) {
      if (body.testProviderId === 'zoom') {
        const test = await executeZoomMeetingConnectionTest();
        return NextResponse.json(test);
      }
      if (body.testProviderId === 'googleMeet') {
        const test = await executeGoogleMeetConnectionTest();
        return NextResponse.json(test);
      }
      if (body.testProviderId === 'microsoftTeams') {
        const test = await executeMicrosoftTeamsConnectionTest();
        return NextResponse.json(test);
      }
      return NextResponse.json({ error: 'Unsupported test provider.' }, { status: 400 });
    }
    const updated = await updateMeetingSettings({
      activeProvider: body.activeProvider,
      providerCredentials: body.providerCredentials as
        | Partial<Record<VideoMeetingProviderId, Record<string, string> | null>>
        | undefined,
    });
    return NextResponse.json(updated);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (error instanceof MeetingSettingsCredentialValidationError) {
      return NextResponse.json({ error: 'Invalid meeting credentials.', details: message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to save meeting settings.', details: message }, { status: 500 });
  }
}
