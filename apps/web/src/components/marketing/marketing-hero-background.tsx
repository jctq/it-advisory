import type { ReactElement } from 'react';
import { cn } from '@/lib/utils';

/**
 * Branded hero backdrop: tinted wash + advisory topology on the right — readable in light and dark themes.
 */
export function MarketingHeroBackground(): ReactElement {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 marketing-hero-base-wash" />
      <div
        className={cn(
          'absolute -right-[6%] top-[-10%] h-[115%] w-[min(95%,880px)]',
          'marketing-hero-art-panel marketing-hero-art-drift',
        )}
      >
        <svg
          className="h-full w-full"
          viewBox="0 0 920 720"
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
            <radialGradient id="hero-node-glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" className="marketing-hero-stop-primary" stopOpacity="0.55" />
              <stop offset="100%" className="marketing-hero-stop-primary" stopOpacity="0" />
            </radialGradient>
            <filter id="hero-soft-blur" x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="22" />
            </filter>
          </defs>
          <g className="marketing-hero-stroke" strokeWidth="1.5" opacity="0.55">
            <ellipse cx="520" cy="300" rx="300" ry="300" stroke="url(#hero-arc-a)" />
            <ellipse cx="560" cy="340" rx="220" ry="220" stroke="url(#hero-arc-b)" strokeWidth="1.25" />
            <path
              d="M120 520 C 260 420, 380 180, 520 120 S 780 80, 860 200"
              stroke="currentColor"
              strokeLinecap="round"
            />
            <path
              d="M80 380 C 200 320, 340 360, 460 280 S 700 160, 820 240"
              stroke="currentColor"
              strokeWidth="1.25"
              strokeDasharray="8 12"
              strokeLinecap="round"
            />
            <path
              d="M200 600 C 320 520, 420 440, 540 400 S 760 360, 840 420"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.8"
            />
          </g>
          <g className="marketing-hero-stroke" opacity="0.85">
            <circle cx="460" cy="280" r="88" className="marketing-hero-fill-soft" filter="url(#hero-soft-blur)" />
            <circle cx="460" cy="280" r="11" className="marketing-hero-fill-primary" />
            <circle cx="460" cy="280" r="28" className="marketing-hero-stroke-primary" fill="none" strokeWidth="1.5" />
            <circle cx="300" cy="360" r="6" className="marketing-hero-fill-primary" />
            <circle cx="620" cy="200" r="6" className="marketing-hero-fill-primary" />
            <circle cx="700" cy="380" r="6" className="marketing-hero-fill-primary" />
            <circle cx="340" cy="500" r="5" className="marketing-hero-fill-primary" />
            <circle cx="580" cy="480" r="5" className="marketing-hero-fill-primary" />
            <line x1="460" y1="280" x2="300" y2="360" className="marketing-hero-stroke-primary" strokeWidth="1.25" />
            <line x1="460" y1="280" x2="620" y2="200" className="marketing-hero-stroke-primary" strokeWidth="1.25" />
            <line x1="460" y1="280" x2="700" y2="380" className="marketing-hero-stroke-primary" strokeWidth="1.25" />
            <line x1="300" y1="360" x2="340" y2="500" className="marketing-hero-stroke-primary" strokeWidth="1" />
            <line x1="700" y1="380" x2="580" y2="480" className="marketing-hero-stroke-primary" strokeWidth="1" />
            <line x1="620" y1="200" x2="700" y2="380" className="marketing-hero-stroke-primary" strokeWidth="1" />
          </g>
          <g className="marketing-hero-stroke-muted" opacity="0.45" strokeWidth="1">
            <rect x="560" y="120" width="112" height="72" rx="14" />
            <rect x="600" y="156" width="112" height="72" rx="14" />
            <rect x="640" y="192" width="112" height="72" rx="14" className="marketing-hero-fill-card" />
          </g>
          <g className="marketing-hero-stroke-primary" opacity="0.35" strokeWidth="1">
            <path
              d="M640 520 L 720 480 L 800 520 L 720 560 Z"
              className="marketing-hero-fill-soft"
            />
            <path d="M520 560 L 600 520 L 680 560 L 600 600 Z" fill="none" />
          </g>
          <g className="marketing-hero-grid" opacity="0.35" strokeWidth="0.75">
            {[140, 200, 260, 320, 380, 440, 500, 560, 620].map((y) => (
              <line key={`h-${y}`} x1="40" y1={y} x2="880" y2={y} />
            ))}
            {[120, 200, 280, 360, 440, 520, 600, 680, 760].map((x) => (
              <line key={`v-${x}`} x1={x} y1="80" x2={x} y2="640" />
            ))}
          </g>
        </svg>
      </div>
      <div className="absolute inset-0 marketing-hero-text-fade" />
      <div className="absolute inset-0 marketing-hero-highlight" />
      <div className="absolute inset-0 marketing-grain opacity-25 dark:opacity-15" />
    </div>
  );
}
