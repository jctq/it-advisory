'use client';

import { motion } from 'framer-motion';
import { useRef, type ReactElement } from 'react';
import type { MarketingHeroInteractionState } from '@/components/marketing/use-marketing-hero-interaction';
import { useHeroSvgFlow } from '@/components/marketing/use-hero-svg-flow';
import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion';
import { cn } from '@/lib/utils';

const HERO_VIEW_WIDTH = 1440;
const HERO_VIEW_HEIGHT = 720;
const HERO_GRID_HORIZONTAL_YS = [140, 200, 260, 320, 380, 440, 500, 560, 620] as const;
const HERO_GRID_VERTICAL_XS = [80, 160, 240, 320, 400, 480, 560, 640, 720, 800, 880, 960, 1040, 1120, 1200, 1280, 1360] as const;

type MarketingHeroBackgroundProps = {
  readonly interaction: MarketingHeroInteractionState;
};

/**
 * Full-bleed hero backdrop with advisory topology, mouse parallax, and ambient line motion.
 */
export function MarketingHeroBackground(props: MarketingHeroBackgroundProps): ReactElement {
  const { interaction } = props;
  const prefersReducedMotion = usePrefersReducedMotion();
  const svgRef = useRef<SVGSVGElement>(null);
  const isMotionActive = !prefersReducedMotion && interaction.isInView;
  useHeroSvgFlow({
    svgRef,
    isBoosted: interaction.isBoosted,
    isActive: isMotionActive,
  });
  return (
    <motion.div
      className="pointer-events-none absolute inset-0 overflow-hidden marketing-hero-interactive"
      style={interaction.rootStyle}
      data-hero-boosted={interaction.isBoosted ? '' : undefined}
      aria-hidden
    >
      <div className="marketing-hero-base-wash absolute inset-0" />
      <div className="marketing-hero-art-accent absolute inset-0" aria-hidden />
      <div className="marketing-hero-canvas absolute inset-0">
        <div
          className={cn('marketing-hero-art-glow marketing-hero-art-drift absolute inset-0')}
          aria-hidden
        />
        <div className="marketing-hero-art-panel-shift absolute inset-0">
          <div className="marketing-hero-orb-layer" aria-hidden>
            <div className="marketing-hero-orb marketing-hero-orb-primary" />
            <div className="marketing-hero-orb marketing-hero-orb-secondary" />
          </div>
          <svg
            ref={svgRef}
            className="marketing-hero-art-svg h-full w-full"
            viewBox={`0 0 ${HERO_VIEW_WIDTH} ${HERO_VIEW_HEIGHT}`}
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            preserveAspectRatio="xMidYMid slice"
            role="presentation"
          >
            <defs>
              <linearGradient id="hero-arc-a" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" className="marketing-hero-stop-primary" stopOpacity="0.9" />
                <stop offset="100%" className="marketing-hero-stop-primary" stopOpacity="0.15" />
              </linearGradient>
              <linearGradient id="hero-arc-b" x1="100%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" className="marketing-hero-stop-primary" stopOpacity="0.75" />
                <stop offset="100%" className="marketing-hero-stop-primary" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="hero-arc-left" x1="0%" y1="100%" x2="100%" y2="0%">
                <stop offset="0%" className="marketing-hero-stop-primary" stopOpacity="0.5" />
                <stop offset="100%" className="marketing-hero-stop-primary" stopOpacity="0" />
              </linearGradient>
              <filter id="hero-soft-blur" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="22" />
              </filter>
            </defs>
            <g className="marketing-hero-parallax-deep marketing-hero-stroke" strokeWidth="1.5" opacity="0.45">
              <ellipse
                cx="260"
                cy="400"
                rx="200"
                ry="200"
                stroke="url(#hero-arc-left)"
                className="marketing-hero-flow-arc"
              />
              <ellipse
                cx="980"
                cy="300"
                rx="320"
                ry="320"
                stroke="url(#hero-arc-a)"
                className="marketing-hero-flow-arc"
              />
              <ellipse
                cx="1040"
                cy="340"
                rx="240"
                ry="240"
                stroke="url(#hero-arc-b)"
                strokeWidth="1.25"
                className="marketing-hero-flow-arc"
              />
            </g>
            <g className="marketing-hero-parallax-mid marketing-hero-stroke" strokeWidth="1.5" opacity="0.5">
              <path
                className="marketing-hero-flow-path"
                d="M40 520 C 180 420, 320 200, 480 140 S 820 60, 1100 180"
                stroke="currentColor"
                strokeLinecap="round"
              />
              <path
                className="marketing-hero-flow-path"
                d="M120 380 C 240 320, 400 360, 560 280 S 900 140, 1280 220"
                stroke="currentColor"
                strokeWidth="1.25"
                strokeDasharray="8 12"
                strokeLinecap="round"
              />
              <path
                className="marketing-hero-flow-path"
                d="M200 600 C 360 520, 520 440, 680 400 S 1020 360, 1320 420"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.8"
              />
              <path
                className="marketing-hero-flow-path"
                d="M80 280 C 200 220, 340 300, 480 240"
                stroke="currentColor"
                strokeWidth="1"
                opacity="0.55"
              />
            </g>
            <g className="marketing-hero-network marketing-hero-parallax-mid" opacity="0.85">
              <circle cx="980" cy="280" r="88" className="marketing-hero-fill-soft" filter="url(#hero-soft-blur)" />
              <circle cx="980" cy="280" r="11" className="marketing-hero-fill-primary marketing-hero-hub-node" />
              <circle
                cx="980"
                cy="280"
                r="28"
                className="marketing-hero-stroke-primary marketing-hero-hub-ring"
                fill="none"
                strokeWidth="1.5"
              />
              <circle cx="820" cy="360" r="6" className="marketing-hero-fill-primary marketing-hero-satellite-node" />
              <circle cx="1140" cy="200" r="6" className="marketing-hero-fill-primary marketing-hero-satellite-node" />
              <circle cx="1220" cy="380" r="6" className="marketing-hero-fill-primary marketing-hero-satellite-node" />
              <circle cx="860" cy="500" r="5" className="marketing-hero-fill-primary marketing-hero-satellite-node" />
              <circle cx="1100" cy="480" r="5" className="marketing-hero-fill-primary marketing-hero-satellite-node" />
              <circle cx="320" cy="420" r="5" className="marketing-hero-fill-primary marketing-hero-satellite-node marketing-hero-left-node" />
              <circle cx="180" cy="300" r="4" className="marketing-hero-fill-primary marketing-hero-satellite-node marketing-hero-left-node" />
              <line
                x1="980"
                y1="280"
                x2="820"
                y2="360"
                className="marketing-hero-stroke-primary marketing-hero-flow-line"
                strokeWidth="1.25"
              />
              <line
                x1="980"
                y1="280"
                x2="1140"
                y2="200"
                className="marketing-hero-stroke-primary marketing-hero-flow-line"
                strokeWidth="1.25"
              />
              <line
                x1="980"
                y1="280"
                x2="1220"
                y2="380"
                className="marketing-hero-stroke-primary marketing-hero-flow-line"
                strokeWidth="1.25"
              />
              <line
                x1="820"
                y1="360"
                x2="860"
                y2="500"
                className="marketing-hero-stroke-primary marketing-hero-flow-line"
                strokeWidth="1"
              />
              <line
                x1="1220"
                y1="380"
                x2="1100"
                y2="480"
                className="marketing-hero-stroke-primary marketing-hero-flow-line"
                strokeWidth="1"
              />
              <line
                x1="1140"
                y1="200"
                x2="1220"
                y2="380"
                className="marketing-hero-stroke-primary marketing-hero-flow-line"
                strokeWidth="1"
              />
              <line
                x1="980"
                y1="280"
                x2="320"
                y2="420"
                className="marketing-hero-stroke-primary marketing-hero-flow-line"
                strokeWidth="1"
                opacity="0.65"
              />
              <line
                x1="320"
                y1="420"
                x2="180"
                y2="300"
                className="marketing-hero-stroke-primary marketing-hero-flow-line"
                strokeWidth="1"
                opacity="0.5"
              />
            </g>
            <g
              className="marketing-hero-grid-group marketing-hero-grid marketing-hero-parallax-light"
              opacity="0.3"
              strokeWidth="0.75"
            >
              {HERO_GRID_HORIZONTAL_YS.map((y) => (
                <line key={`h-${y}`} x1="0" y1={y} x2={HERO_VIEW_WIDTH} y2={y} />
              ))}
              {HERO_GRID_VERTICAL_XS.map((x) => (
                <line key={`v-${x}`} x1={x} y1="80" x2={x} y2="640" />
              ))}
            </g>
            <g className="marketing-hero-stroke-primary marketing-hero-parallax-mid" opacity="0.35" strokeWidth="1">
              <path d="M1160 520 L 1240 480 L 1320 520 L 1240 560 Z" className="marketing-hero-fill-soft" />
              <path d="M1040 560 L 1120 520 L 1200 560 L 1120 600 Z" fill="none" />
            </g>
          </svg>
          <div className="marketing-hero-wireframe-stack" aria-hidden>
            <div className="marketing-hero-wireframe-card marketing-hero-wireframe-card-back" />
            <div className="marketing-hero-wireframe-card marketing-hero-wireframe-card-mid" />
            <div className="marketing-hero-wireframe-card marketing-hero-wireframe-card-front" />
          </div>
        </div>
      </div>
      <div className="absolute inset-0 marketing-hero-text-fade" />
      <div className="absolute inset-0 marketing-hero-highlight" />
      <div className="absolute inset-0 marketing-grain opacity-20 dark:opacity-15" />
    </motion.div>
  );
}
