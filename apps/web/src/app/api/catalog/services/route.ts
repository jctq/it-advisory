import { NextResponse } from 'next/server';
import { getCatalogServiceByKey, getPublicCatalogServices } from '@/lib/data/public-catalog-services';

export async function GET(request: Request): Promise<NextResponse> {
  try {
    const serviceKey = new URL(request.url).searchParams.get('serviceKey')?.trim() ?? '';
    if (serviceKey.length > 0) {
      const service = await getCatalogServiceByKey(serviceKey);
      return NextResponse.json({ service });
    }
    const catalog = await getPublicCatalogServices();
    return NextResponse.json(catalog);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load services.', details: message }, { status: 500 });
  }
}
