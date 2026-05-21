import { diffLines } from 'diff';
import type { BlogPostRevisionSnapshot } from '@/domain/blog-post-revision-types';
import {
  BLOG_POST_REVISION_FIELD_LABELS,
  buildBlogPostRevisionSummary,
  formatBlogPostRevisionFieldValue,
  listChangedBlogPostRevisionFields,
  type BlogPostRevisionDetail,
  type BlogPostRevisionFieldDiff,
  type BlogPostRevisionFieldKey,
  type TextDiffLine,
} from '@/lib/blog-post-revision-types';

function buildTextDiffLines(before: string, after: string): TextDiffLine[] {
  const parts = diffLines(before, after);
  const lines: TextDiffLine[] = [];
  let oldLineNumber = 1;
  let newLineNumber = 1;
  for (const part of parts) {
    const rawLines = part.value.split('\n');
    const partLines = rawLines[rawLines.length - 1] === '' ? rawLines.slice(0, -1) : rawLines;
    for (const lineContent of partLines) {
      if (part.added) {
        lines.push({
          type: 'added',
          content: lineContent,
          oldLineNumber: null,
          newLineNumber: newLineNumber,
        });
        newLineNumber += 1;
        continue;
      }
      if (part.removed) {
        lines.push({
          type: 'removed',
          content: lineContent,
          oldLineNumber: oldLineNumber,
          newLineNumber: null,
        });
        oldLineNumber += 1;
        continue;
      }
      lines.push({
        type: 'unchanged',
        content: lineContent,
        oldLineNumber: oldLineNumber,
        newLineNumber: newLineNumber,
      });
      oldLineNumber += 1;
      newLineNumber += 1;
    }
  }
  return lines;
}

function buildFieldDiff(
  field: BlogPostRevisionFieldKey,
  before: BlogPostRevisionSnapshot,
  after: BlogPostRevisionSnapshot,
): BlogPostRevisionFieldDiff {
  const beforeDisplay = formatBlogPostRevisionFieldValue(field, before[field]);
  const afterDisplay = formatBlogPostRevisionFieldValue(field, after[field]);
  return {
    field,
    label: BLOG_POST_REVISION_FIELD_LABELS[field],
    beforeDisplay,
    afterDisplay,
    lines: buildTextDiffLines(beforeDisplay, afterDisplay),
  };
}

export function buildBlogPostRevisionDetail(params: {
  readonly id: string;
  readonly savedAtIso: string;
  readonly before: BlogPostRevisionSnapshot;
  readonly after: BlogPostRevisionSnapshot;
}): BlogPostRevisionDetail {
  const changedFields = listChangedBlogPostRevisionFields(params.before, params.after);
  return {
    id: params.id,
    savedAtIso: params.savedAtIso,
    changedFields,
    fieldDiffs: changedFields.map((field) => buildFieldDiff(field, params.before, params.after)),
  };
}

export function buildBlogPostRevisionSummaryFromSnapshots(
  before: BlogPostRevisionSnapshot,
  after: BlogPostRevisionSnapshot,
): string {
  return buildBlogPostRevisionSummary(listChangedBlogPostRevisionFields(before, after));
}
