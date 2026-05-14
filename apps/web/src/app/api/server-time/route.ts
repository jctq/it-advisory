import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Returns the server's current instant so clients can correct for a skewed device clock.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    { nowIso: new Date().toISOString() },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    },
  );
}
