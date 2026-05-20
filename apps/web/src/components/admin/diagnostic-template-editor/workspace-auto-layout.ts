import type { DiagnosticTemplateValue } from '@/lib/diagnostic-template-types';
import { readQuestionTypeLabel } from '@/components/admin/diagnostic-template-editor/diagnostic-template-editor-utils';
import {
  CARD_MIN_HEIGHT,
  CARD_MIN_WIDTH,
  ROUND_CONTENT_TOP,
  ROUND_MIN_HEIGHT,
  ROUND_MIN_WIDTH,
  ROUND_PADDING_BOTTOM,
  ROUND_PADDING_X,
} from '@/components/admin/diagnostic-template-editor/workspace-layout-constants';

const H_GAP = 20;
const V_GAP = 12;
const OPTIONS_TOP_GAP = 32;
const OPTION_INDENT = 20;
const CARD_PADDING_X = 24;
const CARD_HEADER_HEIGHT = 22;
const CARD_SUBTITLE_HEIGHT = 14;
const CARD_VERTICAL_GAP = 4;
const CHAR_WIDTH_PX = 6.5;
const LINE_HEIGHT_PX = 16;
const OPTION_MAX_WIDTH = 240;
const QUESTION_MAX_WIDTH = 480;

export type AutoLayoutNodeSize = {
  readonly width: number;
  readonly height: number;
};

export type AutoLayoutPlacedNode = {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type AutoLayoutRoundResult = {
  readonly roundWidth: number;
  readonly roundHeight: number;
  readonly children: readonly AutoLayoutPlacedNode[];
};

function wrapLabelLines(label: string, maxCharsPerLine: number): readonly string[] {
  const trimmed = label.trim();
  if (trimmed.length === 0) {
    return ['Untitled'];
  }
  const words = trimmed.split(/\s+/);
  const lines: string[] = [];
  let currentLine = '';
  for (const word of words) {
    const candidate = currentLine.length === 0 ? word : `${currentLine} ${word}`;
    if (candidate.length <= maxCharsPerLine) {
      currentLine = candidate;
      continue;
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    if (word.length > maxCharsPerLine) {
      let remaining = word;
      while (remaining.length > maxCharsPerLine) {
        lines.push(remaining.slice(0, maxCharsPerLine));
        remaining = remaining.slice(maxCharsPerLine);
      }
      currentLine = remaining;
      continue;
    }
    currentLine = word;
  }
  if (currentLine.length > 0) {
    lines.push(currentLine);
  }
  return lines.length > 0 ? lines : ['Untitled'];
}

export function estimateCardSize(params: {
  readonly label: string;
  readonly kind: 'question' | 'option' | 'childQuestion';
  readonly maxWidth?: number;
  readonly subtitle?: string;
}): AutoLayoutNodeSize {
  const maxContentWidth =
    params.kind === 'question' ? QUESTION_MAX_WIDTH : OPTION_MAX_WIDTH;
  const maxCharsPerLine = Math.max(8, Math.floor((maxContentWidth - CARD_PADDING_X) / CHAR_WIDTH_PX));
  const lines = wrapLabelLines(params.label, maxCharsPerLine);
  const longestLineChars = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const contentWidth = Math.ceil(longestLineChars * CHAR_WIDTH_PX) + CARD_PADDING_X;
  const maxWidth = params.maxWidth ?? maxContentWidth;
  const width = Math.max(
    params.kind === 'question' ? 260 : CARD_MIN_WIDTH,
    Math.min(maxWidth, contentWidth),
  );
  const lineCount = params.kind === 'question' ? Math.max(lines.length, 2) : lines.length;
  const hasSubtitle = (params.subtitle?.trim().length ?? 0) > 0;
  const subtitleBlockHeight = hasSubtitle ? CARD_SUBTITLE_HEIGHT + CARD_VERTICAL_GAP : 0;
  const height = Math.max(
    CARD_MIN_HEIGHT,
    CARD_HEADER_HEIGHT + lineCount * LINE_HEIGHT_PX + subtitleBlockHeight + (params.kind === 'question' ? 8 : 4),
  );
  return { width, height };
}

function buildOptionColumnCount(optionCount: number): number {
  if (optionCount <= 2) {
    return optionCount;
  }
  if (optionCount <= 4) {
    return 2;
  }
  if (optionCount <= 6) {
    return 3;
  }
  return 3;
}

export function buildAutoLayoutForRound(params: {
  readonly round: DiagnosticTemplateValue['rounds'][number];
  readonly roundNodeId: string;
  readonly questionNodeId: (questionId: string) => string;
  readonly optionNodeId: (optionId: string) => string;
  readonly childNodeId: (childId: string) => string;
}): AutoLayoutRoundResult {
  const children: AutoLayoutPlacedNode[] = [];
  let cursorY = ROUND_CONTENT_TOP;
  let maxContentRight = ROUND_MIN_WIDTH - ROUND_PADDING_X * 2;
  for (const question of params.round.questions) {
    const questionId = params.questionNodeId(question.id);
    const questionSize = estimateCardSize({
      label: question.prompt,
      kind: 'question',
      subtitle: readQuestionTypeLabel(question.type),
    });
    const questionX = ROUND_PADDING_X;
    children.push({
      id: questionId,
      x: questionX,
      y: cursorY,
      width: questionSize.width,
      height: questionSize.height,
    });
    maxContentRight = Math.max(maxContentRight, questionX + questionSize.width);
    cursorY += questionSize.height + OPTIONS_TOP_GAP;
    if (question.options.length === 0) {
      continue;
    }
    const columnCount = buildOptionColumnCount(question.options.length);
    const columnWidths: number[] = Array.from({ length: columnCount }, () => CARD_MIN_WIDTH);
    const optionSizes = question.options.map((option) =>
      estimateCardSize({ label: option.label, kind: 'option' }),
    );
    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      for (let optionIndex = columnIndex; optionIndex < question.options.length; optionIndex += columnCount) {
        columnWidths[columnIndex] = Math.max(columnWidths[columnIndex] ?? CARD_MIN_WIDTH, optionSizes[optionIndex]?.width ?? CARD_MIN_WIDTH);
      }
    }
    const rowCount = Math.ceil(question.options.length / columnCount);
    const rowHeights: number[] = Array.from({ length: rowCount }, () => CARD_MIN_HEIGHT);
    for (let optionIndex = 0; optionIndex < question.options.length; optionIndex += 1) {
      const columnIndex = optionIndex % columnCount;
      const rowIndex = Math.floor(optionIndex / columnCount);
      const option = question.options[optionIndex];
      if (option === undefined || optionSizes[optionIndex] === undefined) {
        continue;
      }
      const optionSize = optionSizes[optionIndex]!;
      rowHeights[rowIndex] = Math.max(rowHeights[rowIndex] ?? CARD_MIN_HEIGHT, optionSize.height);
      if (option.childQuestion !== null) {
        const childOptionCount = option.childQuestion.options.length;
        const childSize = estimateCardSize({
          label: option.childQuestion.prompt,
          kind: 'childQuestion',
          subtitle:
            childOptionCount > 0
              ? `${childOptionCount} nested option${childOptionCount === 1 ? '' : 's'}`
              : undefined,
        });
        rowHeights[rowIndex] = Math.max(rowHeights[rowIndex] ?? CARD_MIN_HEIGHT, optionSize.height + V_GAP + childSize.height);
      }
    }
    let optionY = cursorY;
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      let optionX = ROUND_PADDING_X + OPTION_INDENT;
      const rowHeight = rowHeights[rowIndex] ?? CARD_MIN_HEIGHT;
      for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
        const optionIndex = rowIndex * columnCount + columnIndex;
        const option = question.options[optionIndex];
        if (option === undefined || optionSizes[optionIndex] === undefined) {
          continue;
        }
        const optionSize = optionSizes[optionIndex]!;
        const colWidth = columnWidths[columnIndex] ?? optionSize.width;
        children.push({
          id: params.optionNodeId(option.id),
          x: optionX,
          y: optionY,
          width: colWidth,
          height: optionSize.height,
        });
        maxContentRight = Math.max(maxContentRight, optionX + colWidth);
        if (option.childQuestion !== null) {
          const nestedOptionCount = option.childQuestion.options.length;
          const childSize = estimateCardSize({
            label: option.childQuestion.prompt,
            kind: 'childQuestion',
            subtitle:
              nestedOptionCount > 0
                ? `${nestedOptionCount} nested option${nestedOptionCount === 1 ? '' : 's'}`
                : undefined,
          });
          children.push({
            id: params.childNodeId(option.childQuestion.id),
            x: optionX,
            y: optionY + optionSize.height + V_GAP,
            width: colWidth,
            height: childSize.height,
          });
          maxContentRight = Math.max(maxContentRight, optionX + colWidth);
        }
        optionX += colWidth + H_GAP;
      }
      optionY += rowHeight + V_GAP;
    }
    cursorY = optionY;
  }
  const roundWidth = Math.max(ROUND_MIN_WIDTH, maxContentRight + ROUND_PADDING_X);
  const roundHeight = Math.max(ROUND_MIN_HEIGHT, cursorY + ROUND_PADDING_BOTTOM);
  const innerWidth = roundWidth - ROUND_PADDING_X * 2;
  const expandedChildren = children.map((child) =>
    child.id.startsWith('question:') && child.width < innerWidth
      ? { ...child, width: innerWidth }
      : child,
  );
  return {
    roundWidth,
    roundHeight,
    children: expandedChildren,
  };
}
