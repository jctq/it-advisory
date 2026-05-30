import { notFound } from 'next/navigation';
import { BlogPostEditor } from '@/components/admin/blog-post-editor';
import { findBlogPostById } from '@/lib/data/blog-posts';

export const metadata = {
  title: 'Edit blog post — TeqMD Admin',
};

export const dynamic = 'force-dynamic';

type AdminBlogPostEditorPageProps = {
  readonly params: Promise<{ readonly postId: string }>;
};

export default async function AdminBlogPostEditorPage(props: AdminBlogPostEditorPageProps) {
  const { postId } = await props.params;
  const post = await findBlogPostById(postId);
  if (post === null) {
    notFound();
  }
  return <BlogPostEditor initialPost={post} />;
}
