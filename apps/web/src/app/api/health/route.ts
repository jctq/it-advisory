import { NextResponse } from 'next/server';
import { resolveConfiguredApiOrigin } from '@/lib/config/api-origin';
import { resolveConfiguredAppOrigin } from '@/lib/config/app-origin';

export async function GET(): Promise<NextResponse> {
  const apiOrigin = resolveConfiguredApiOrigin();
  const appOrigin = resolveConfiguredAppOrigin();
  const mongoConfigured = Boolean(process.env.MONGODB_URI);
  return NextResponse.json({
    ok: true,
    apiOrigin,
    appOrigin,
    isApiOriginConfigured: apiOrigin !== null,
    isHostedOriginConfigured: appOrigin !== null,
    mongoConfigured,
    timezone: 'Asia/Manila',
  });
}
