import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteBlogPost, findBlogPostById, isValidBlogPostSlug, updateBlogPost } from '@/lib/data/blog-posts';

export const dynamic = 'force-dynamic';

const blogPostStatusSchema = z.enum(['draft', 'published']);

const updateBlogPostSchema = z.object({
  title: z.string().trim().max(200).nullable().optional(),
  description: z.string().trim().max(500).nullable().optional(),
  slug: z
    .string()
    .trim()
    .max(120)
    .optional()
    .refine((value) => value === undefined || value.length === 0 || isValidBlogPostSlug(value), {
      message: 'Slug must contain only lowercase letters, numbers, and hyphens.',
    }),
  contentMarkdown: z.string().max(500_000).optional(),
  status: blogPostStatusSchema.optional(),
  showInBlogList: z.boolean().optional(),
  showTitle: z.boolean().optional(),
});

type RouteContext = {
  readonly params: Promise<{ readonly postId: string }>;
};

export async function GET(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { postId } = await context.params;
  try {
    const post = await findBlogPostById(postId);
    if (post === null) {
      return NextResponse.json({ error: 'Blog post not found.' }, { status: 404 });
    }
    return NextResponse.json({ post });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load blog post.', details: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<NextResponse> {
  const { postId } = await context.params;
  let json: unknown = {};
  try {
    json = await request.json();
  } catch {}
  const parsed = updateBlogPostSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const post = await updateBlogPost(postId, parsed.data);
    return NextResponse.json({ post });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Blog post not found.' ? 404 : 500;
    return NextResponse.json({ error: 'Failed to update blog post.', details: message }, { status });
  }
}

export async function DELETE(_request: Request, context: RouteContext): Promise<NextResponse> {
  const { postId } = await context.params;
  try {
    await deleteBlogPost(postId);
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    const status = message === 'Blog post not found.' ? 404 : 500;
    return NextResponse.json({ error: 'Failed to delete blog post.', details: message }, { status });
  }
}
