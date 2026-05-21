import { BlogPostsList } from '@/components/admin/blog-posts-list';
import { listBlogPosts } from '@/lib/data/blog-posts';

export const metadata = {
  title: 'Blog — TechMD Admin',
};

export const dynamic = 'force-dynamic';

export default async function AdminBlogPostsPage() {
  let posts: Awaited<ReturnType<typeof listBlogPosts>> = [];
  let loadError: string | null = null;
  try {
    posts = await listBlogPosts();
  } catch (error: unknown) {
    loadError = error instanceof Error ? error.message : 'Failed to load blog posts.';
  }
  return <BlogPostsList initialPosts={posts} loadError={loadError} />;
}
