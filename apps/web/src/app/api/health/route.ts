import { NextResponse } from 'next/server';

export async function GET(): Promise<NextResponse> {
  const mongoConfigured = Boolean(process.env.MONGODB_URI);
  return NextResponse.json({
    ok: true,
    mongoConfigured,
    timezone: 'Asia/Manila',
  });
}
