const MARKDOWN_CODE_FENCE_PATTERN = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i;

/**
 * Unwraps content accidentally pasted inside a single markdown code fence
 * (common when copying from chat or docs).
 */
export function unwrapAccidentalMarkdownCodeFence(markdown: string): string {
  const trimmedValue = markdown.trim();
  const match = MARKDOWN_CODE_FENCE_PATTERN.exec(trimmedValue);
  if (match === null) {
    return markdown;
  }
  return match[1] ?? markdown;
}

/**
 * Normalizes CMS markdown before save/render.
 */
export function normalizeBlogContentMarkdown(markdown: string): string {
  return unwrapAccidentalMarkdownCodeFence(markdown);
}
