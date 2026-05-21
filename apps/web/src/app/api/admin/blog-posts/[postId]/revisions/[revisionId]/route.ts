import { NextResponse } from 'next/server';
import { findBlogPostRevisionById } from '@/lib/data/blog-post-revisions';

export const dynamic = 'force-dynamic';

type RouteContext = {
  readonly params: Promise<{ readonly postId: string; readonly revisionId: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { postId, revisionId } = await context.params;
  try {
    const revision = await findBlogPostRevisionById(postId, revisionId);
    if (revision === null) {
      return NextResponse.json({ error: 'Revision not found.' }, { status: 404 });
    }
    return NextResponse.json({ revision });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load revision.', details: message }, { status: 500 });
  }
}
