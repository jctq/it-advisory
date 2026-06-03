import { NextResponse } from 'next/server';
import { jsonApiErrorFromUnknown } from '@/lib/server/api-error-response';
import { readBlogImageBuffer } from '@/lib/data/blog-images';

export const dynamic = 'force-dynamic';

type RouteContext = {
  readonly params: Promise<{ readonly imageId: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { imageId } = await context.params;
  try {
    const payload = await readBlogImageBuffer(imageId);
    if (payload === null) {
      return NextResponse.json({ error: 'Image not found.' }, { status: 404 });
    }
    return new NextResponse(new Uint8Array(payload.buffer), {
      status: 200,
      headers: {
        'Content-Type': payload.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error: unknown) {
    return jsonApiErrorFromUnknown(error, { error: 'Failed to load image.', status: 500 });
  }
}
