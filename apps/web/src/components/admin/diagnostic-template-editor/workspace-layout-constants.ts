/** Reserved height of the round node header (must match `RoundGroupNode` header UI). */
export const ROUND_HEADER_HEIGHT = 96;

/** Horizontal inset for nodes placed inside a round. */
export const ROUND_PADDING_X = 20;

/** Gap between the round header and the first child node. */
export const ROUND_CONTENT_GAP = 12;

/** Minimum Y for nodes placed inside a round (header + gap). */
export const ROUND_CONTENT_TOP = ROUND_HEADER_HEIGHT + ROUND_CONTENT_GAP;

/** Bottom inset inside a round (room for edge labels and handles). */
export const ROUND_PADDING_BOTTOM = 32;

/** @deprecated Use {@link ROUND_CONTENT_TOP}. */
export const ROUND_HEADER = ROUND_CONTENT_TOP;

export const ROUND_DEFAULT_WIDTH = 520;
export const ROUND_DEFAULT_MIN_HEIGHT = 220;
export const ROUND_MIN_WIDTH = 320;
export const ROUND_MIN_HEIGHT = 160;
export const CARD_DEFAULT_WIDTH = 168;
export const CARD_DEFAULT_HEIGHT = 64;
export const CARD_MIN_WIDTH = 120;
export const CARD_MIN_HEIGHT = 52;
export const QUESTION_DEFAULT_HEIGHT = 72;

export type RoundChildPosition = {
  readonly x: number;
  readonly y: number;
};

export function clampRoundChildPosition(position: RoundChildPosition): RoundChildPosition {
  return {
    x: Math.max(position.x, ROUND_PADDING_X),
    y: Math.max(position.y, ROUND_CONTENT_TOP),
  };
}
