import { NextResponse } from 'next/server';
import { z } from 'zod';
import { buildTransactionalEmailTemplatePreviews } from '@/lib/email/transactional-email-template-previews';

const querySchema = z.object({
  bookingConfirmationSubject: z.string().max(500).optional(),
});

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    bookingConfirmationSubject: url.searchParams.get('bookingConfirmationSubject') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const templates = await buildTransactionalEmailTemplatePreviews({
      bookingConfirmationSubject: parsed.data.bookingConfirmationSubject,
    });
    return NextResponse.json({ templates });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to build email template previews.', details: message }, { status: 500 });
  }
}
