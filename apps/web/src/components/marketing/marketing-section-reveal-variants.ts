import type { Variants } from 'framer-motion';

const EASE_OUT_QUINT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export type MarketingSectionRevealDirection = 'up' | 'right' | 'left';

const REVEAL_OFFSET_PX = 56;

function buildHiddenMotion(direction: MarketingSectionRevealDirection): {
  readonly opacity: number;
  readonly x?: number;
  readonly y?: number;
  readonly scale: number;
} {
  if (direction === 'right') {
    return { opacity: 0, x: REVEAL_OFFSET_PX, scale: 0.98 };
  }
  if (direction === 'left') {
    return { opacity: 0, x: -REVEAL_OFFSET_PX, scale: 0.98 };
  }
  return { opacity: 0, y: 48, scale: 0.98 };
}

export function createMarketingSectionRevealItemVariants(
  direction: MarketingSectionRevealDirection = 'up',
): Variants {
  return {
    hidden: buildHiddenMotion(direction),
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.75,
        ease: EASE_OUT_QUINT,
      },
    },
  };
}

export const marketingSectionRevealItemVariants = createMarketingSectionRevealItemVariants('up');

export const marketingSectionRevealContainerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.14,
      delayChildren: 0.06,
    },
  },
};

export const marketingSectionRevealViewport = {
  once: true,
  amount: 0.2,
  margin: '0px 0px -8% 0px',
} as const;
