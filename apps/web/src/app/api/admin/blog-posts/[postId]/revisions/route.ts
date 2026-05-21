import { NextResponse } from 'next/server';
import { listBlogPostRevisions } from '@/lib/data/blog-post-revisions';

export const dynamic = 'force-dynamic';

type RouteContext = {
  readonly params: Promise<{ readonly postId: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { postId } = await context.params;
  try {
    const revisions = await listBlogPostRevisions(postId);
    return NextResponse.json({ revisions });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load revision history.', details: message }, { status: 500 });
  }
}
