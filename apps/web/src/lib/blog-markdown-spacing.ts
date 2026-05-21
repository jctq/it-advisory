import type { Paragraph, Parents } from 'mdast';
import type { Info, Options as ToMarkdownOptions, State } from 'mdast-util-to-markdown';

/** Paragraph placeholder so empty lines survive MDXEditor markdown round-trips. */
export const BLOG_EMPTY_LINE_MARKER = '\u00a0';

function isEmptyParagraph(node: Paragraph): boolean {
  if (node.children.length === 0) {
    return true;
  }
  return node.children.every((child) => {
    if (child.type === 'text') {
      const trimmedValue = child.value.replace(/\u00a0/g, '').trim();
      return trimmedValue.length === 0;
    }
    return false;
  });
}

function serializeParagraph(state: State, node: Paragraph, info: Info): string {
  const exit = state.enter('paragraph');
  const subexit = state.enter('phrasing');
  const value = state.containerPhrasing(node, info);
  subexit();
  exit();
  return value;
}

function serializeEmptyParagraph(state: State): string {
  const exit = state.enter('paragraph');
  const subexit = state.enter('phrasing');
  const value = BLOG_EMPTY_LINE_MARKER;
  subexit();
  exit();
  return value;
}

/**
 * MDXEditor export options: keep blank lines created with multiple Enter presses.
 */
export const blogPostEditorToMarkdownOptions: ToMarkdownOptions = {
  handlers: {
    paragraph(node: Paragraph, parent: Parents | undefined, state: State, info: Info): string {
      if (isEmptyParagraph(node)) {
        return serializeEmptyParagraph(state);
      }
      return serializeParagraph(state, node, info);
    },
  },
};
