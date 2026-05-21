import { buildApiUrl } from '@/lib/config/build-api-url';

type BlogImageUploadResponse = {
  readonly url?: string;
  readonly error?: string;
  readonly details?: string;
};

/**
 * Uploads a pasted or selected image from the admin blog editor.
 * Returns a public URL path for markdown embedding.
 */
export async function uploadBlogImage(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);
  const response = await fetch(buildApiUrl('/api/admin/blog-images'), {
    method: 'POST',
    body: formData,
    credentials: 'same-origin',
  });
  const data = (await response.json()) as BlogImageUploadResponse;
  if (!response.ok || data.url === undefined) {
    throw new Error(data.details ?? data.error ?? 'Failed to upload image.');
  }
  return data.url;
}
