import rehypeRemark from 'rehype-remark';
import rehypeSanitize from 'rehype-sanitize';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import remarkStringify from 'remark-stringify';
import { unified } from 'unified';
import { normalizeBlogContentMarkdown } from '@/lib/blog-markdown-normalize';

const sanitizePipeline = unified()
  .use(remarkParse)
  .use(remarkRehype, { allowDangerousHtml: true })
  .use(rehypeSanitize)
  .use(rehypeRemark)
  .use(remarkStringify);

/**
 * Strips dangerous HTML from CMS markdown before persistence.
 */
export function sanitizeBlogContentMarkdownForStorage(markdown: string): string {
  const normalized = normalizeBlogContentMarkdown(markdown);
  const result = sanitizePipeline.processSync(normalized);
  return String(result);
}
