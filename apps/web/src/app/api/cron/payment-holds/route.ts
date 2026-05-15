import { NextResponse } from 'next/server';
import { expireStalePaymentHolds } from '@/lib/payments/hold-expiry';

export async function POST(request: Request): Promise<NextResponse> {
  const cronSecret = process.env.CRON_SECRET?.trim() ?? '';
  if (cronSecret.length > 0) {
    const header = request.headers.get('authorization') ?? '';
    if (header !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }
  const expiredCount = await expireStalePaymentHolds();
  return NextResponse.json({ ok: true, expiredCount });
}
