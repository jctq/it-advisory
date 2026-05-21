const MARKDOWN_IMAGE_PATTERN = /!\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/;

/**
 * Returns the first image URL from markdown body content, if any.
 */
export function extractBlogPostCoverImageUrl(contentMarkdown: string): string | null {
  const match = MARKDOWN_IMAGE_PATTERN.exec(contentMarkdown);
  if (match === null) {
    return null;
  }
  const url = match[1]?.trim() ?? '';
  return url.length > 0 ? url : null;
}
