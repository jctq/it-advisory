'use client';

import { motion } from 'framer-motion';
import { Children, isValidElement, type ReactElement, type ReactNode } from 'react';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';
import {
  createMarketingSectionRevealItemVariants,
  marketingSectionRevealContainerVariants,
  marketingSectionRevealViewport,
  type MarketingSectionRevealDirection,
} from '@/components/marketing/marketing-section-reveal-variants';

type MarketingSectionRevealElement = 'div' | 'ul' | 'ol' | 'section';

type MarketingSectionRevealProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly as?: MarketingSectionRevealElement;
  readonly stagger?: boolean;
  readonly direction?: MarketingSectionRevealDirection;
};

/**
 * In-view reveal (fade, lift, de-blur). Does not dim off-screen sections.
 */
export function MarketingSectionReveal(props: MarketingSectionRevealProps): ReactElement {
  const prefersReducedMotion = usePrefersReducedMotion();
  const stagger = props.stagger ?? true;
  const direction = props.direction ?? 'up';
  const itemVariants = createMarketingSectionRevealItemVariants(direction);
  const Tag = props.as ?? 'div';
  if (prefersReducedMotion) {
    return <Tag className={props.className}>{props.children}</Tag>;
  }
  const childArray = Children.toArray(props.children);
  const shouldStagger = stagger && childArray.length > 1;
  const MotionTag = motion[Tag];
  if (!shouldStagger) {
    return (
      <MotionTag
        className={props.className}
        variants={itemVariants}
        initial="hidden"
        whileInView="visible"
        viewport={marketingSectionRevealViewport}
      >
        {props.children}
      </MotionTag>
    );
  }
  return (
    <MotionTag
      className={props.className}
      variants={marketingSectionRevealContainerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={marketingSectionRevealViewport}
    >
      {childArray.map((child, index) => (
        <MarketingSectionRevealItem
          key={isValidElement(child) && child.key != null ? String(child.key) : `marketing-reveal-${index}`}
          as={Tag === 'ul' || Tag === 'ol' ? 'li' : 'div'}
          className="h-full"
          direction={direction}
        >
          {child}
        </MarketingSectionRevealItem>
      ))}
    </MotionTag>
  );
}

type MarketingSectionRevealItemElement = 'div' | 'li' | 'article';

type MarketingSectionRevealItemProps = {
  readonly children: ReactNode;
  readonly className?: string;
  readonly as?: MarketingSectionRevealItemElement;
  readonly direction?: MarketingSectionRevealDirection;
};

export function MarketingSectionRevealItem(props: MarketingSectionRevealItemProps): ReactElement {
  const prefersReducedMotion = usePrefersReducedMotion();
  const Tag = props.as ?? 'div';
  if (prefersReducedMotion) {
    return <Tag className={props.className}>{props.children}</Tag>;
  }
  const MotionTag = motion[Tag];
  return (
    <MotionTag
      className={props.className}
      variants={createMarketingSectionRevealItemVariants(props.direction ?? 'up')}
    >
      {props.children}
    </MotionTag>
  );
}
