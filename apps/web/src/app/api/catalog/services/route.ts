import { NextResponse } from 'next/server';
import { jsonApiErrorFromUnknown } from '@/lib/server/api-error-response';
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
    return jsonApiErrorFromUnknown(error, { error: 'Failed to load services.', status: 500 });
  }
}
