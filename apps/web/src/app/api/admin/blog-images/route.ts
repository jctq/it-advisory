import { NextResponse } from 'next/server';
import { createBlogImage, getMaxBlogImageBytes, isAllowedBlogImageContentType } from '@/lib/data/blog-images';

export const dynamic = 'force-dynamic';

export async function POST(request: Request): Promise<NextResponse> {
  try {
    const formData = await request.formData();
    const fileEntry = formData.get('file');
    if (!(fileEntry instanceof File)) {
      return NextResponse.json({ error: 'Missing image file.' }, { status: 400 });
    }
    const contentType = fileEntry.type.trim();
    if (!isAllowedBlogImageContentType(contentType)) {
      return NextResponse.json(
        { error: 'Unsupported image type. Use JPEG, PNG, GIF, or WebP.' },
        { status: 400 },
      );
    }
    if (fileEntry.size > getMaxBlogImageBytes()) {
      return NextResponse.json({ error: 'Image is too large. Maximum size is 5 MB.' }, { status: 400 });
    }
    const buffer = Buffer.from(await fileEntry.arrayBuffer());
    const image = await createBlogImage({
      contentType,
      buffer,
      originalFilename: fileEntry.name.trim().length > 0 ? fileEntry.name : null,
    });
    return NextResponse.json({ url: image.publicUrl, imageId: image.id }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to upload image.', details: message }, { status: 500 });
  }
}
