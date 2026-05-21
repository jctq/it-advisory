import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createBlogPost, isValidBlogPostSlug, listBlogPosts } from '@/lib/data/blog-posts';

export const dynamic = 'force-dynamic';

const blogPostStatusSchema = z.enum(['draft', 'published']);

const createBlogPostSchema = z.object({
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

export async function GET(): Promise<NextResponse> {
  try {
    const posts = await listBlogPosts();
    return NextResponse.json({ posts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to load blog posts.', details: message }, { status: 500 });
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  let json: unknown = {};
  try {
    json = await request.json();
  } catch {}
  const parsed = createBlogPostSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 400 });
  }
  try {
    const post = await createBlogPost({
      title: parsed.data.title,
      description: parsed.data.description,
      slug: parsed.data.slug,
      contentMarkdown: parsed.data.contentMarkdown,
      status: parsed.data.status,
      showInBlogList: parsed.data.showInBlogList,
      showTitle: parsed.data.showTitle,
    });
    return NextResponse.json({ post }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to create blog post.', details: message }, { status: 500 });
  }
}
